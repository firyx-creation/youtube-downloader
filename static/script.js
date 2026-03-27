// ─── État global ───
let selectedFormat = null;
let currentVideoUrl = null;

// ─── Éléments DOM ───
const urlInput       = document.getElementById('urlInput');
const fetchBtn       = document.getElementById('fetchBtn');
const clearBtn       = document.getElementById('clearBtn');
const errorMsg       = document.getElementById('errorMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const videoSection   = document.getElementById('videoSection');
const formatsList    = document.getElementById('formatsList');
const downloadArea   = document.getElementById('downloadArea');
const downloadBtn    = document.getElementById('downloadBtn');
const downloadBtnSub = document.getElementById('downloadBtnSub');
const downloadStatus = document.getElementById('downloadStatus');
const progressContainer = document.getElementById('progressContainer');
const progressFill   = document.getElementById('progressFill');
const progressPct    = document.getElementById('progressPercent');
const progressLabel  = document.getElementById('progressLabel');
const progressDetail = document.getElementById('progressDetail');

// ─── Events ───
fetchBtn.addEventListener('click', fetchVideoInfo);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchVideoInfo(); });
urlInput.addEventListener('input', () => {
    clearBtn.classList.toggle('visible', urlInput.value.length > 0);
});
clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.classList.remove('visible');
    urlInput.focus();
    hideError();
    videoSection.style.display = 'none';
});
downloadBtn.addEventListener('click', startDownload);

// ─── Fetch info vidéo ───
async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    if (!url) { showError('Veuillez entrer une URL YouTube'); return; }

    currentVideoUrl = url;
    selectedFormat  = null;

    fetchBtn.disabled = true;
    fetchBtn.querySelector('.btn-text').textContent = '…';
    loadingSpinner.style.display = 'flex';
    videoSection.style.display   = 'none';
    hideError();

    try {
        const res  = await fetch('/api/video-info', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ url }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Erreur inconnue');
        renderVideoInfo(data);
    } catch (err) {
        showError('❌ ' + err.message);
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.querySelector('.btn-text').textContent = 'Analyser';
        loadingSpinner.style.display = 'none';
    }
}

// ─── Afficher infos vidéo ───
function renderVideoInfo(data) {
    document.getElementById('thumbnail').src            = data.thumbnail;
    document.getElementById('videoTitle').textContent   = data.title;
    document.getElementById('videoDuration').textContent = '⏱ ' + fmtDuration(data.duration);
    document.getElementById('videoChannel').textContent  = '📺 ' + (data.channel || '—');

    formatsList.innerHTML = '';
    data.formats.forEach(fmt => formatsList.appendChild(buildFormatCard(fmt)));

    videoSection.style.display   = 'block';
    downloadArea.style.display   = 'none';
    downloadStatus.style.display = 'none';

    // Auto-sélection : préférer 1080p, sinon 720p, sinon meilleur dispo
    const best =
        data.formats.find(f => f.type === 'video' && f.height === 1080) ||
        data.formats.find(f => f.type === 'video' && f.height === 720)  ||
        data.formats.find(f => f.type === 'video' && f.height > 0)      ||
        data.formats[0];

    if (best) {
        const safeId = best.format_id.replace(/[+]/g, '\\+');
        const bestEl = formatsList.querySelector(`[data-id="${safeId}"]`);
        if (bestEl) bestEl.click();
    }

    setTimeout(() => videoSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

// ─── Badge qualité ───
function qualityBadge(fmt) {
    if (fmt.type === 'audio') return '<div class="format-badge badge-audio">AUDIO</div>';
    const h = fmt.height;
    if (h >= 2160) return '<div class="format-badge badge-4k">4K</div>';
    if (h >= 1440) return '<div class="format-badge badge-2k">2K</div>';
    if (h >= 1080) return '<div class="format-badge badge-hd">FULL HD</div>';
    if (h >= 720)  return '<div class="format-badge badge-hd">HD</div>';
    return '';
}

// ─── Carte format ───
function buildFormatCard(fmt) {
    const isAudio = fmt.type === 'audio' || fmt.height <= 0;
    const div = document.createElement('div');
    div.className = 'format-option' + (isAudio ? ' audio-option' : '');
    // Stocker le format_id encodé pour le retrouver avec querySelector
    div.setAttribute('data-id', fmt.format_id);

    const badge = qualityBadge(fmt);
    const size  = fmt.filesize > 0 ? (fmt.filesize / 1048576).toFixed(0) + ' MB' : '';
    const fps   = fmt.fps > 0 && fmt.fps !== 30 ? fmt.fps + 'fps' : '';
    const merge = fmt.needs_merge ? '<div class="merge-tag">+audio</div>' : '';

    div.innerHTML = `
        ${badge}
        <div class="format-res">${isAudio ? '🎵' : fmt.resolution}</div>
        <div class="format-meta">
            ${fmt.ext ? fmt.ext.toUpperCase() : ''}
            ${fps  ? '<br>' + fps  : ''}
            ${size ? '<br>' + size : ''}
        </div>
        ${merge}
    `;

    div.addEventListener('click', () => selectFormat(fmt, div));
    return div;
}

// ─── Sélection format ───
function selectFormat(fmt, el) {
    document.querySelectorAll('.format-option').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedFormat = fmt;

    const isAudio = fmt.type === 'audio' || fmt.height <= 0;
    downloadBtnSub.textContent = isAudio
        ? `Sauvegarder en audio ${fmt.ext?.toUpperCase() || 'M4A'}`
        : `Télécharger en ${fmt.resolution} · ${fmt.ext?.toUpperCase() || 'MP4'}`;

    downloadArea.style.display      = 'block';
    downloadStatus.style.display    = 'none';
    progressContainer.style.display = 'none';
}

// ─── Lancer le téléchargement ───
async function startDownload() {
    if (!selectedFormat || !currentVideoUrl) return;

    const isAudio = selectedFormat.type === 'audio' || selectedFormat.height <= 0;

    downloadBtn.disabled = true;
    downloadBtn.querySelector('.btn-text').textContent = '⏳ Préparation…';
    downloadStatus.style.display = 'none';

    progressContainer.style.display = 'block';
    progressFill.style.width = '0%';
    progressPct.textContent  = '0%';
    progressLabel.textContent  = isAudio ? 'Extraction audio…' : `Téléchargement ${selectedFormat.resolution}…`;
    progressDetail.textContent = 'Connexion au serveur…';

    let prog = 0;
    const phases = ['Connexion…', 'Récupération des données…', 'Encodage…', 'Finalisation…'];
    const interval = setInterval(() => {
        const step = prog < 30 ? 8 : prog < 60 ? 5 : prog < 85 ? 3 : 1;
        prog = Math.min(prog + step * Math.random(), 92);
        progressFill.style.width = prog + '%';
        progressPct.textContent  = Math.round(prog) + '%';
        const pi = Math.floor((prog / 100) * phases.length);
        progressDetail.textContent = phases[Math.min(pi, phases.length - 1)];
    }, 400);

    try {
        const response = await fetch('/api/download', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                url:       currentVideoUrl,
                format_id: selectedFormat.format_id,
                is_audio:  isAudio,
            }),
        });

        clearInterval(interval);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Erreur serveur');
        }

        progressFill.style.width   = '100%';
        progressPct.textContent    = '100%';
        progressDetail.textContent = 'Téléchargement vers votre appareil…';

        const blob = await response.blob();
        const cd   = response.headers.get('Content-Disposition') || '';
        const nm   = cd.match(/filename="?([^"]+)"?/);
        const filename = nm ? decodeURIComponent(nm[1]) : (isAudio ? 'audio.m4a' : 'video.mp4');

        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        setTimeout(() => {
            progressContainer.style.display = 'none';
            showStatus('success', '✅ Téléchargement réussi ! Le fichier est dans vos Téléchargements.');
        }, 600);

    } catch (err) {
        clearInterval(interval);
        progressContainer.style.display = 'none';
        showStatus('error', '❌ ' + err.message);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.querySelector('.btn-text').textContent = '⬇ Télécharger';
    }
}

// ─── Helpers ───
function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('show'); }
function hideError()    { errorMsg.classList.remove('show'); }
function showStatus(type, msg) {
    downloadStatus.className   = 'status-message ' + type;
    downloadStatus.textContent = msg;
    downloadStatus.style.display = 'block';
}
function fmtDuration(secs) {
    if (!secs) return '--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
}
