COMPOSE := $(shell if docker compose version >/dev/null 2>&1; then printf 'docker compose'; else printf 'docker-compose'; fi)

.PHONY: up down logs ps build full fclean

up:
	$(COMPOSE) up --build -d
	@printf '\nft_transcendence is running:\n'
	@printf '  frontend: http://localhost:3000\n'
	@printf '  backend:  http://localhost:8080\n'

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

build:
	$(COMPOSE) build

full:
	npm ci --prefix frontend
	cargo check --manifest-path server/Cargo.toml
	npm run --prefix frontend build
	npm run --prefix frontend lint
	$(COMPOSE) build

fclean:
	$(COMPOSE) down --volumes --rmi local --remove-orphans
	rm -rf frontend/node_modules frontend/dist server/target
