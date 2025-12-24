all: build up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

# Light build (no background animation - faster compile)
light: build-light up-light

build-light:
	docker compose -f docker-compose.light.yml build

up-light:
	docker compose -f docker-compose.light.yml up -d

down-light:
	docker compose -f docker-compose.light.yml down

rebuild: 
	docker compose build --no-cache

logs:
	docker compose logs -f

clean: down
	rm -rf srcs/frontend/dist/*
	rm -rf srcs/backend/dist/*

fclean: clean
		docker system prune -af

rm-data: down
	docker volume rm ft_transcendence_db_storage 2>/dev/null || true
	docker volume rm ft_transcendence_avatar_storage 2>/dev/null || true

re: fclean build up

backend-build:
	cd srcs/backend && npx tsc --build --force

frontend-build:
	cd srcs/frontend && npx tsc --build --force

# Convenience: DB inspection
users:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("/app/db/pong.db"); const rows=db.prepare("select id,email,username,avatar_url,wins,losses,created_at from users order by id").all(); console.log(JSON.stringify(rows,null,2));'

users-count:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("/app/db/pong.db"); const row=db.prepare("select count(*) as n from users").get(); console.log(row.n);'

matches:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("/app/db/pong.db"); const rows=db.prepare("select m.id, winner.username as winner, loser.username as loser, m.winner_score, m.loser_score, m.match_type, m.created_at from matches m join users winner on m.winner_id = winner.id join users loser on m.loser_id = loser.id order by m.created_at desc").all(); console.log(JSON.stringify(rows,null,2));'

friend-requests:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("/app/db/pong.db"); const rows=db.prepare("select fr.id, s.username as sender, r.username as receiver, fr.status, fr.created_at from friend_requests fr join users s on fr.sender_id = s.id join users r on fr.receiver_id = r.id order by fr.created_at desc").all(); console.log(JSON.stringify(rows,null,2));'

clean-old-requests:
	docker compose exec backend node -e 'const Database=require("better-sqlite3"); const db=new Database("/app/db/pong.db"); const result=db.prepare("DELETE FROM friend_requests WHERE status IN (\"accepted\", \"rejected\")").run(); console.log("Deleted", result.changes, "old friend requests");'

db-copy:
	docker compose cp backend:/app/db/pong.db ./pong.db

# Optional (requires sqlite3 on host):
users-sql: db-copy
	sqlite3 ./pong.db 'SELECT id,email,username,created_at FROM users ORDER BY id;'

.PHONY: all up down build rebuild logs clean fclean rm-data re backend-build frontend-build users users-count matches friend-requests clean-old-requests db-copy users-sql light build-light up-light down-light