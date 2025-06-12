FROM node:18-alpine

WORKDIR /app

COPY ./srcs/frontend/package*.json ./

RUN npm install && npm install -g http-server typescript

COPY ./srcs/frontend/ ./

# Compile le TypeScript et Tailwind
RUN npx tsc && npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
