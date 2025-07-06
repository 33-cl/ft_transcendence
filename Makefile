all: build up

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

rebuild: 
	docker compose build --no-cache

logs:
	docker compose logs -f

clean: down
	rm -rf srcs/frontend/dist/*
	docker system prune -af

fclean: clean
	docker volume prune -f

re: fclean build up

backend-build:
	cd srcs/backend && npx tsc --build --force

frontend-build:
	cd srcs/frontend && npx tsc --build --force

.PHONY: all up down build rebuild logs clean fclean re