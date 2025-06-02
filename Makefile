all: build up

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

rebuild:
	docker-compose build --no-cache

logs:
	docker-compose logs -f

clean: down
	docker system prune -af

fclean: clean
	docker volume prune -f

re: fclean build up

.PHONY: all up down build rebuild logs clean fclean re 