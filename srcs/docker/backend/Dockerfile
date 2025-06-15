FROM node:20-slim

WORKDIR /app

COPY ./srcs/backend/package*.json ./

RUN npm install

COPY ./srcs/backend/ ./

RUN npx tsc

COPY ./srcs/docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Avant installation, on s'assure que node_modules n'existe pas
RUN rm -rf node_modules && npm install

EXPOSE 8080

ENTRYPOINT []

CMD ["/app/entrypoint.sh"]