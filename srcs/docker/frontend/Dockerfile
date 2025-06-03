FROM node:18-alpine

WORKDIR /app

COPY ./srcs/frontend/package*.json ./

RUN npm install && npm install -g http-server typescript

COPY ./srcs/frontend/ ./

# Compile le TypeScript avant de servir
RUN npx tsc

EXPOSE 3000

CMD ["http-server", "-p", "3000", "-c-1", "--cors"]
