# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native modules
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package manifests and install deps
COPY ./srcs/backend/package*.json ./
RUN npm ci || npm install

# Build better-sqlite3 from source to ensure correct native binding
RUN npm rebuild better-sqlite3 --build-from-source

# Copy backend sources (node_modules excluded via root .dockerignore)
COPY ./srcs/backend/ ./

# Compile TypeScript
RUN npx tsc


# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

# Copy built app and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# Copy source and tsconfig for optional rebuild in entrypoint (dev)
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Entrypoint & runtime
COPY ./srcs/docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT []
CMD ["/app/entrypoint.sh"]