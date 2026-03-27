// États globaux
let selectedFormat = null;
let currentVideoUrl = null;

// Éléments du DOM
const urlInput = document.getElementById('urlInput');
const fetchBtn = document.getElementById('fetchBtn');
const errorMessage = document.getElementById('errorMessage');
const loadingSpinner = document.getElementById('loadingSpinner');
const videoSection = document.getElementById('videoSection');
const formatsList = document.getElementById('formatsList');
const downloadBtn = document.getElementById('downloadBtn');
const downloadStatus = document.getElementById('downloadStatus');
const downloadsList = document.getElementById('downloadsList');

// Event Listeners
fetchBtn.addEventListener('click', fetchVideoInfo);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchVideoInfo();
});
downloadBtn.addEventListener('click', downloadVideo);

// Charger la liste des téléchargements au démarrage
document.addEventListener('DOMContentLoaded', loadDownloadsList);

/**
 * Récupère les informations de la vidéo et les formats disponibles
 */
async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Veuillez entrer une URL YouTube');
        return;
    }

    currentVideoUrl = url;
    selectedFormat = null;
    downloadBtn.style.display = 'none';

    // Afficher le spinner
    loadingSpinner.style.display = 'block';
    videoSection.style.display = 'none';
    hideError();

    try {
        const response = await fetch('/api/video-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de la récupération des informations');
        }

        const data = await response.json();
        displayVideoInfo(data);

    } catch (error) {
        showError(error.message);
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

/**
 * Affiche les informations de la vidéo et les formats disponibles
 */
function displayVideoInfo(data) {
    // Afficher les infos vidéo
    document.getElementById('thumbnail').src = data.thumbnail;
    document.getElementById('videoTitle').textContent = data.title;
    document.getElementById('videoDuration').textContent = `Durée: ${formatDuration(data.duration)}`;

    // Afficher les formats
    formatsList.innerHTML = '';
    data.formats.forEach(format => {
        const formatElement = createFormatElement(format);
        formatsList.appendChild(formatElement);
    });

    videoSection.style.display = 'block';
}

/**
 * Crée un élément de format sélectionnable
 */
function createFormatElement(format) {
    const div = document.createElement('div');
    div.className = 'format-option';
    div.innerHTML = `
        <div class="format-resolution">${format.resolution}</div>
        <div class="format-info">
            ${format.fps > 0 ? `<div>${format.fps}fps</div>` : ''}
            ${format.filesize > 0 ? `<div>${(format.filesize / (1024 * 1024)).toFixed(1)} MB</div>` : '<div>Taille inconnue</div>'}
        </div>
    `;

    div.addEventListener('click', () => selectFormat(format, div));

    return div;
}

/**
 * Sélectionne un format
 */
function selectFormat(format, element) {
    // Désélectionner l'ancien format
    document.querySelectorAll('.format-option').forEach(el => {
        el.classList.remove('selected');
    });

    // Sélectionner le nouveau format
    element.classList.add('selected');
    selectedFormat = format;
    downloadBtn.style.display = 'block';
    downloadStatus.style.display = 'none';
}

/**
 * Télécharge la vidéo
 */
async function downloadVideo() {
    if (!selectedFormat || !currentVideoUrl) {
        showError('Veuillez sélectionner un format');
        return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = '⏳ Téléchargement en cours...';
    downloadStatus.style.display = 'none';

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: currentVideoUrl,
                format_id: selectedFormat.format_id
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors du téléchargement');
        }

        const data = await response.json();
        showDownloadSuccess(data.message);
        
        // Recharger la liste des téléchargements
        setTimeout(loadDownloadsList, 1000);

    } catch (error) {
        showDownloadError(error.message);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇️ Télécharger';
    }
}

/**
 * Récupère et affiche la liste des téléchargements
 */
async function loadDownloadsList() {
    try {
        const response = await fetch('/api/downloads');
        if (!response.ok) throw new Error('Erreur lors de la récupération des téléchargements');

        const data = await response.json();
        displayDownloadsList(data.files);
    } catch (error) {
        console.error('Erreur:', error);
    }
}

/**
 * Affiche la liste des fichiers téléchargés
 */
function displayDownloadsList(files) {
    if (files.length === 0) {
        downloadsList.innerHTML = '<p class="empty-message">Aucun téléchargement pour le moment</p>';
        return;
    }

    downloadsList.innerHTML = files.map(file => `
        <div class="download-item">
            <div class="download-item-info">
                <div class="download-item-name">📥 ${escapeHtml(file.name)}</div>
                <div class="download-item-size">${file.size}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Affiche un message d'erreur
 */
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

/**
 * Cache le message d'erreur
 */
function hideError() {
    errorMessage.classList.remove('show');
}

/**
 * Affiche un message de succès de téléchargement
 */
function showDownloadSuccess(message) {
    downloadStatus.className = 'download-status success';
    downloadStatus.textContent = '✅ ' + message;
    downloadStatus.style.display = 'block';
}

/**
 * Affiche un message d'erreur de téléchargement
 */
function showDownloadError(message) {
    downloadStatus.className = 'download-status error';
    downloadStatus.textContent = '❌ ' + message;
    downloadStatus.style.display = 'block';
}

/**
 * Formate la durée en format HH:MM:SS
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
