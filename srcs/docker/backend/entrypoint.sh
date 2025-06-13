#!/bin/sh
set -e

apk add --no-cache openssl

if [ ! -f key.pem ] || [ ! -f cert.pem ]; then
  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
fi

npx tsc --build --force
node dist/server.js
