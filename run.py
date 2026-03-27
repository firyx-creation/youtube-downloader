#!/usr/bin/env python3
"""
Script de lancement local pour tester l'application
"""
import os
import sys

# Ajouter le dossier api au path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

from index import app

if __name__ == '__main__':
    # Configuration pour le développement local
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.run(debug=True, host='127.0.0.1', port=5000)
