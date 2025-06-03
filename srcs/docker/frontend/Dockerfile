FROM node:18-alpine

WORKDIR /app

COPY ./srcs/frontend/package*.json ./

RUN npm install -g http-server && npm install

COPY ./srcs/frontend/ ./

EXPOSE 3000

CMD ["http-server", "-p", "3000", "-c-1", "--cors"] 