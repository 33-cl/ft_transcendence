FROM node:18-alpine

WORKDIR /app

COPY ./srcs/backend/package*.json ./

RUN npm install -g typescript ts-node

RUN npm install

COPY ./srcs/backend/ ./

EXPOSE 8080

CMD ["ts-node", "server.ts"] 