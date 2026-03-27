# YouTube Video Downloader 🎬

Une application web simple et élégante pour télécharger des vidéos YouTube avec la qualité de votre choix.

## 🌟 Fonctionnalités

- ✅ Téléchargement de vidéos YouTube
- ✅ Sélection de la qualité (360p, 480p, 720p, 1080p, etc.)
- ✅ Option audio uniquement
- ✅ Interface moderne et intuitive (style YouTube Dark)
- ✅ Affichage des informations vidéo (titre, durée, miniature)
- ✅ Liste des téléchargements
- ✅ Gestion des erreurs

## 🚀 Installation

### Prérequis
- Python 3.8+
- pip (gestionnaire de paquets Python)

### Étapes

1. **Clonez ou accédez au dossier du projet**
   ```bash
   cd youtube-downloader
   ```

2. **Créez un environnement virtuel (recommandé)**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Installez les dépendances**
   ```bash
   pip install -r requirements.txt
   ```

## 💻 Utilisation

1. **Lancez l'application**
   ```bash
   python app.py
   ```

2. **Ouvrez votre navigateur**
   ```
   http://localhost:5000
   ```

3. **Téléchargez une vidéo**
   - Collez l'URL de votre vidéo YouTube
   - Cliquez sur "Charger les formats"
   - Sélectionnez la qualité souhaitée
   - Cliquez sur "Télécharger"

## 📁 Structure du projet

```
youtube-downloader/
├── app.py                 # Backend Flask
├── requirements.txt       # Dépendances Python
├── templates/
│   └── index.html        # Page HTML principale
├── static/
│   ├── style.css         # Styles CSS
│   └── script.js         # Logique JavaScript
└── downloads/            # Dossier pour les vidéos téléchargées
```

## 🔧 Configuration

### Dossier de téléchargement
Par défaut, les vidéos sont sauvegardées dans le dossier `downloads/` au même niveau que `app.py`.

Pour modifier le chemin, éditez la ligne dans `app.py`:
```python
DOWNLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'downloads')
```

## ⚠️ Restrictions légales

- **À usage personnel uniquement** - Respectez les termes de service de YouTube
- **Ne téléchargez que du contenu dont vous avez les droits**
- Cette application est fournie à titre éducatif

## 🐛 Dépannage

### "Erreur: L'URL n'est pas valide"
- Vérifiez que vous avez copié toute l'URL
- Assurez-vous que c'est une URL YouTube valide

### "Erreur: Impossible d'extraire les informations vidéo"
- Vérifiez votre connexion Internet
- La vidéo peut être privée ou supprimée
- Essayez avec une autre vidéo

### "Le téléchargement échoue"
- Vérifiez l'espace disque disponible
- La vidéo peut être très grande
- Réessayez après quelques minutes

## 📦 Dépendances principales

- **Flask** - Framework web
- **Flask-CORS** - Gestion des requêtes CORS
- **yt-dlp** - Téléchargement de vidéos YouTube

## 📝 Notes de développement

- L'application utilise une architecture flask simple
- Les formats vidéo sont filtrés pour inclure vidéo + audio
- L'interface est responsive et fonctionne sur mobile

## 🤝 Contribution

Si vous trouvez des bugs ou avez des suggestions, n'hésitez pas à les signaler.

---

**Créé avec ❤️ pour les amateurs de vidéos**
