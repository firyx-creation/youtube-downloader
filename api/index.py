from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
import yt_dlp
import os
import shutil
import tempfile
import threading
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE_DIR = BASE_DIR.parent / 'templates'
STATIC_DIR = BASE_DIR.parent / 'static'

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR)
)
CORS(app)


def has_ffmpeg():
    return shutil.which('ffmpeg') is not None or shutil.which('ffmpeg.exe') is not None


progress_data = {}
progress_lock = threading.Lock()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/video-info', methods=['POST'])
def get_video_info():
    """
    Récupère les infos vidéo + tous les formats disponibles.
    Stratégie :
      - Si ffmpeg dispo → on propose toutes les résolutions (merge vidéo+audio si besoin)
      - Sinon → on propose uniquement les formats natifs vidéo+audio
    """
    try:
        data = request.json
        url = data.get('url', '').strip()

        if not url:
            return jsonify({'error': 'URL vide'}), 400

        ydl_opts = {'quiet': True, 'no_warnings': True}

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        ffmpeg_ok = has_ffmpeg()

        # ── Collecter les meilleurs formats vidéo par résolution ────────────────
        best_per_height = {}   # height -> dict

        for fmt in info.get('formats', []):
            vcodec = fmt.get('vcodec', 'none')
            acodec = fmt.get('acodec', 'none')
            height  = fmt.get('height') or 0
            if height <= 0 or vcodec == 'none':
                continue

            has_audio = acodec != 'none'
            tbr = fmt.get('tbr') or fmt.get('vbr') or 0
            filesize = fmt.get('filesize') or fmt.get('filesize_approx') or 0
            ext = fmt.get('ext', 'mp4')

            # Si pas de ffmpeg, ignorer les formats sans audio intégré
            if not has_audio and not ffmpeg_ok:
                continue

            entry = {
                'format_id': fmt.get('format_id'),
                'resolution': f"{height}p",
                'height': height,
                'ext': ext,
                'fps': fmt.get('fps') or 30,
                'filesize': filesize,
                'has_audio': has_audio,
                'tbr': tbr,
                'type': 'video',
                'needs_merge': not has_audio,
            }

            prev = best_per_height.get(height)
            if prev is None:
                best_per_height[height] = entry
            else:
                # Préférer : 1) audio natif > merge, 2) tbr plus élevé
                prefer_new = (
                    (has_audio and not prev['has_audio']) or
                    (has_audio == prev['has_audio'] and tbr > prev['tbr'])
                )
                if prefer_new:
                    best_per_height[height] = entry

        # ── Construire la liste des formats vidéo ──────────────────────────────
        formats = []
        for height in sorted(best_per_height.keys(), reverse=True):
            entry = best_per_height[height]

            # Pour un format vidéo-only avec ffmpeg, on construira
            # un format_id composite : "vidID+bestaudio"
            if entry['needs_merge']:
                entry['format_id'] = f"{entry['format_id']}+bestaudio"
                # L'extension finale sera mp4 après merge
                entry['ext'] = 'mp4'

            formats.append(entry)

        # ── Meilleur format audio ───────────────────────────────────────────────
        audio_formats = []
        for fmt in info.get('formats', []):
            if fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none':
                abr = fmt.get('abr') or fmt.get('tbr') or 0
                audio_formats.append({
                    'format_id': fmt.get('format_id'),
                    'ext': fmt.get('ext', 'm4a'),
                    'abr': abr,
                    'filesize': fmt.get('filesize') or 0,
                })

        if audio_formats:
            best_audio = max(audio_formats, key=lambda x: x['abr'])
            formats.append({
                'format_id': best_audio['format_id'],
                'resolution': f"🎵 Audio ({best_audio['ext'].upper()})",
                'height': -1,
                'ext': best_audio['ext'],
                'fps': 0,
                'filesize': best_audio['filesize'],
                'type': 'audio',
                'needs_merge': False,
            })

        return jsonify({
            'success': True,
            'title': info.get('title', 'Vidéo'),
            'thumbnail': info.get('thumbnail', ''),
            'duration': info.get('duration', 0),
            'channel': info.get('uploader', ''),
            'view_count': info.get('view_count', 0),
            'formats': formats,
            'ffmpeg_available': ffmpeg_ok,
        })

    except Exception as e:
        return jsonify({'error': f'Erreur : {str(e)}'}), 400


@app.route('/api/download', methods=['POST'])
def download_video():
    """
    Télécharge la vidéo/audio dans la qualité demandée et renvoie le fichier.
    Si format_id contient '+bestaudio', ffmpeg est requis (merge).
    """
    try:
        data = request.json
        url = data.get('url', '').strip()
        format_id = data.get('format_id', '')

        if not url:
            return jsonify({'error': 'URL manquante'}), 400
        if not format_id:
            return jsonify({'error': 'Format manquant'}), 400

        tmp_dir = tempfile.mkdtemp()
        output_template = os.path.join(tmp_dir, '%(title)s.%(ext)s')

        # Si le format demande un merge, on ajoute les postprocessors ffmpeg
        needs_merge = '+' in format_id
        ydl_opts = {
            'format': format_id,
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'restrictfilenames': True,
        }

        if needs_merge:
            ydl_opts['merge_output_format'] = 'mp4'

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)

        # Trouver le fichier le plus lourd (le fichier final)
        files = [f for f in os.listdir(tmp_dir) if os.path.isfile(os.path.join(tmp_dir, f))]
        if not files:
            return jsonify({'error': 'Fichier introuvable après téléchargement'}), 500

        files.sort(key=lambda f: os.path.getsize(os.path.join(tmp_dir, f)), reverse=True)
        filename = files[0]
        filepath = os.path.join(tmp_dir, filename)

        ext = os.path.splitext(filename)[1].lower()
        mimetypes_map = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mkv': 'video/x-matroska',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.mp3': 'audio/mpeg',
            '.opus': 'audio/ogg',
        }
        mimetype = mimetypes_map.get(ext, 'application/octet-stream')
        filesize = os.path.getsize(filepath)

        def generate_and_cleanup():
            try:
                with open(filepath, 'rb') as f:
                    while True:
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        yield chunk
            finally:
                try:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
                except Exception:
                    pass

        return Response(
            generate_and_cleanup(),
            mimetype=mimetype,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': str(filesize),
            }
        )

    except Exception as e:
        return jsonify({'error': f'Erreur : {str(e)}'}), 400


@app.route('/api/progress/<session_id>', methods=['GET'])
def get_progress(session_id):
    """Endpoint SSE pour la progression en temps réel"""
    def generate():
        import time
        while True:
            with progress_lock:
                data = progress_data.get(session_id, {})
            yield f"data: {json.dumps(data)}\n\n"
            if data.get('status') in ('done', 'error'):
                break
            time.sleep(0.5)

    return Response(generate(), mimetype='text/event-stream')
