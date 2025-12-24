#!/bin/sh
set -e

# check certificates
if [ ! -f key.pem ] || [ ! -f cert.pem ]; then
  echo "[entrypoint] ERROR: Missing SSL certificates, they should be generated at build time!"
  exit 1
else
  echo "[entrypoint] SSL certificates detected, starting server..."
fi

# use the build already compiled
exec node dist/server.js
