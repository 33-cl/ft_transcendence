FROM node:18-alpine

WORKDIR /app

COPY ./srcs/backend/package*.json ./

RUN npm install

COPY ./srcs/backend/ ./

RUN npx tsc

EXPOSE 8080

# Compile TypeScript à chaque démarrage du conteneur
CMD npx tsc --build --force && node dist/server.js