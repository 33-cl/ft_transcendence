#!/bin/sh
set -e

# Vérifie que les certificats sont bien présents (générés à la build)
if [ ! -f key.pem ] || [ ! -f cert.pem ]; then
  echo "[entrypoint] ERREUR: Certificats SSL manquants, ils devraient être générés à la build !"
  exit 1
else
  echo "[entrypoint] Certificats SSL détectés, démarrage du serveur..."
fi

# Ne recompile pas en runtime, utilise le build produit à l'image
exec node dist/server.js
