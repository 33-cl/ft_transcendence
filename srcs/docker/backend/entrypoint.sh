#!/bin/sh
set -e

# Vérifie si openssl est installé, sinon l'installe (utile en dev/CI)
if ! command -v openssl >/dev/null 2>&1; then
  apt-get update && apt-get install -y openssl
fi

# Génère un certificat auto-signé si absent
if [ ! -f key.pem ] || [ ! -f cert.pem ]; then
  echo "[entrypoint] Génération d'un certificat SSL auto-signé (key.pem/cert.pem) pour Fastify..."
  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
else
  echo "[entrypoint] Certificats SSL déjà présents, aucune génération."
fi

# Ne recompile pas en runtime, utilise le build produit à l'image
exec node dist/server.js
