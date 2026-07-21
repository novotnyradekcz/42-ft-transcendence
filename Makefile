COMPOSE      := $(shell if docker compose version >/dev/null 2>&1; then printf 'docker compose'; else printf 'docker-compose'; fi)
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml -f docker-compose.production.yml

.PHONY: up up-prod down logs ps build full fclean

up:
	$(COMPOSE) up --build -d
	@printf '\nft_transcendence is running (local / self-signed HTTPS):\n'
	@printf '  frontend: https://localhost\n'
	@printf '  backend:  http://localhost:8080\n'

up-prod:
	$(COMPOSE_PROD) up --build -d
	@printf '\nft_transcendence is running (production / Lets Encrypt):\n'
	@printf '  frontend: https://transcendence.spaceorange.eu\n'
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
