FROM node:20-slim

WORKDIR /app

# Install build tools and runtime dependencies
RUN apt-get update && \
    apt-get install -y python3 make g++ sqlite3 openssl && \
    rm -rf /var/lib/apt/lists/*

# Generate SSL certificates
RUN openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Copy backend sources and install dependencies
COPY ./srcs/backend/ ./
RUN npm ci || npm install
RUN npm install --save-dev @types/jsonwebtoken
RUN npm rebuild better-sqlite3 --build-from-source

# Compile TypeScript
RUN npx tsc

# Entrypoint
COPY ./srcs/docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

CMD ["/app/entrypoint.sh"]