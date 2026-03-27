from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import yt_dlp
import os
import threading
from pathlib import Path

app = Flask(__name__)
CORS(app)

# Dossier de téléchargement
DOWNLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'downloads')
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/video-info', methods=['POST'])
def get_video_info():
    """Récupère les informations de la vidéo et les formats disponibles"""
    try:
        data = request.json
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'URL vide'}), 400
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Récupérer les formats disponibles
            formats = []
            seen_resolutions = set()
            
            for fmt in info.get('formats', []):
                # Filtrer les formats vidéo avec audio
                if fmt.get('vcodec') != 'none' and fmt.get('acodec') != 'none':
                    height = fmt.get('height', 0)
                    ext = fmt.get('ext', 'mp4')
                    
                    if height and height not in seen_resolutions:
                        seen_resolutions.add(height)
                        formats.append({
                            'format_id': fmt.get('format_id'),
                            'resolution': f"{height}p",
                            'height': height,
                            'ext': ext,
                            'fps': fmt.get('fps', 30),
                            'filesize': fmt.get('filesize', 0)
                        })
            
            # Ajouter format audio uniquement
            for fmt in info.get('formats', []):
                if fmt.get('vcodec') == 'none' and fmt.get('acodec') != 'none':
                    formats.append({
                        'format_id': fmt.get('format_id'),
                        'resolution': 'Audio seulement',
                        'height': 0,
                        'ext': fmt.get('ext', 'm4a'),
                        'fps': 0,
                        'filesize': fmt.get('filesize', 0)
                    })
                    break
            
            # Trier par résolution (du plus haut au plus bas)
            formats.sort(key=lambda x: x['height'], reverse=True)
            
            return jsonify({
                'success': True,
                'title': info.get('title', 'Vidéo'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0),
                'formats': formats
            })
    
    except Exception as e:
        return jsonify({'error': f'Erreur: {str(e)}'}), 400

@app.route('/api/download', methods=['POST'])
def download_video():
    """Télécharge la vidéo avec la qualité sélectionnée"""
    try:
        data = request.json
        url = data.get('url', '').strip()
        format_id = data.get('format_id', '')
        
        if not url or not format_id:
            return jsonify({'error': 'URL ou format manquant'}), 400
        
        output_template = os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s')
        
        ydl_opts = {
            'format': format_id,
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'restrictfilenames': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            return jsonify({
                'success': True,
                'message': 'Téléchargement réussi!',
                'filename': os.path.basename(filename)
            })
    
    except Exception as e:
        return jsonify({'error': f'Erreur de téléchargement: {str(e)}'}), 400

@app.route('/api/downloads', methods=['GET'])
def list_downloads():
    """Liste les fichiers téléchargés"""
    try:
        files = []
        if os.path.exists(DOWNLOAD_FOLDER):
            for file in os.listdir(DOWNLOAD_FOLDER):
                filepath = os.path.join(DOWNLOAD_FOLDER, file)
                if os.path.isfile(filepath):
                    size = os.path.getsize(filepath) / (1024 * 1024)  # En MB
                    files.append({
                        'name': file,
                        'size': f"{size:.2f} MB"
                    })
        return jsonify({'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
