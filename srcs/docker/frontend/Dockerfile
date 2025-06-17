# Stage 1: Build frontend assets
FROM node:alpine AS builder

WORKDIR /app
COPY ./srcs/frontend/package*.json ./
RUN npm install && \
    npm install -D tailwindcss postcss autoprefixer
COPY ./srcs/frontend/ ./
RUN npx tsc --build --force && \
    npx tailwindcss -i ./styles/input.css -o ./styles/output.css

# Stage 2: Nginx static server
FROM nginx:alpine

RUN apk add --no-cache openssl

WORKDIR /app
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/index.html /app/index.html
COPY --from=builder /app/styles /app/styles
COPY --from=builder /app/src /app/src

COPY ./srcs/docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY ./srcs/docker/frontend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]