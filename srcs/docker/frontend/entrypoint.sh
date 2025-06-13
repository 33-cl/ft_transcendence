#!/bin/sh
set -e

# Génère un certificat auto-signé si besoin
if [ ! -f /etc/nginx/ssl/nginx.key ] || [ ! -f /etc/nginx/ssl/nginx.crt ]; then
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/CN=localhost"
fi

# Lance nginx en mode non-démon
nginx -g 'daemon off;'
