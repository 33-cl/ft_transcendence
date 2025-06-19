FROM node:20-slim

WORKDIR /app

COPY ./srcs/backend/package*.json ./

# On supprime node_modules et package-lock.json pour éviter tout conflit de versions natives,
# notamment avec better-sqlite3, et garantir une installation propre dans l'image Docker.
RUN rm -rf node_modules package-lock.json

# Install native dependencies for better-sqlite3 (Debian/Ubuntu)
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install

COPY ./srcs/backend/ ./

RUN npx tsc

COPY ./srcs/docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT []

CMD ["/app/entrypoint.sh"]