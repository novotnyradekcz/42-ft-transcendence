COMPOSE := $(shell if docker compose version >/dev/null 2>&1; then printf 'docker compose'; else printf 'docker-compose'; fi)

.PHONY: up down logs ps build full re re-front fclean

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

re:
	$(COMPOSE) up -d db
	$(COMPOSE) up --build -d --force-recreate --no-deps server frontend
	@printf '\nft_transcendence rebuilt and running:\n'
	@printf '  frontend: http://localhost:3000\n'
	@printf '  backend:  http://localhost:8080\n'

re-front:
	$(COMPOSE) up --build -d --force-recreate --no-deps frontend
	@printf '\nfrontend rebuilt: http://localhost:3000\n'

fclean:
	$(COMPOSE) down --volumes --rmi local --remove-orphans
	rm -rf frontend/node_modules frontend/dist server/target
