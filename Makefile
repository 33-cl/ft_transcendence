all: backend-build frontend-build build up

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild: backend-build frontend-build
	docker compose build --no-cache

logs:
	docker compose logs -f backend

clean: down
	rm -rf srcs/frontend/dist/*
	docker system prune -af

fclean: clean
	docker volume prune -f

re: fclean all

backend-build:
	cd srcs/backend && npx tsc --build --force

frontend-build:
	cd srcs/frontend && npx tsc --build --force

run-backend:
	npx ts-node srcs/backend/server.ts

rebuild-backend:
	docker compose build --no-cache backend

restart-backend:
	docker compose up -d backend

fix-backend:
	make rebuild-backend
	make restart-backend
	make logs

.PHONY: all up down build rebuild logs clean fclean re