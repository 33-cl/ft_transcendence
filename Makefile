all: build up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

rebuild: 
	docker compose build --no-cache

logs:
	docker compose logs -f

clean: down
	rm -rf srcs/frontend/dist/*
	rm -rf srcs/backend/dist/*
	docker system prune -af

fclean: clean
	docker volume prune -f

re: fclean build up

backend-build:
	cd srcs/backend && npx tsc --build --force

frontend-build:
	cd srcs/frontend && npx tsc --build --force

# Convenience: DB inspection
users:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("pong.db"); const rows=db.prepare("select id,email,username,avatar_url,wins,losses,created_at from users order by id").all(); console.log(JSON.stringify(rows,null,2));'

users-count:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("pong.db"); const row=db.prepare("select count(*) as n from users").get(); console.log(row.n);'

matches:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("pong.db"); const rows=db.prepare("select m.id, winner.username as winner, loser.username as loser, m.winner_score, m.loser_score, m.match_type, m.created_at from matches m join users winner on m.winner_id = winner.id join users loser on m.loser_id = loser.id order by m.created_at desc").all(); console.log(JSON.stringify(rows,null,2));'

db-copy:
	docker compose cp backend:/app/pong.db ./pong.db

# Optional (requires sqlite3 on host):
users-sql: db-copy
	sqlite3 ./pong.db 'SELECT id,email,username,created_at FROM users ORDER BY id;'

.PHONY: all up down build rebuild logs clean fclean re backend-build frontend-build users users-count db-copy users-sql