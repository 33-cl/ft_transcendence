FROM node:20-alpine

WORKDIR /app

COPY ./srcs/backend/package*.json ./

RUN npm install

COPY ./srcs/backend/ ./

RUN npx tsc

COPY ./srcs/docker/backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT []

CMD ["/app/entrypoint.sh"]