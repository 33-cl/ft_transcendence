FROM node:18-alpine

WORKDIR /app

COPY ./srcs/backend/package*.json ./

RUN npm install

COPY ./srcs/backend/ ./

RUN npx tsc

EXPOSE 8080

CMD ["node", "dist/server.js"]