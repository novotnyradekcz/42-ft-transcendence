# Merged ft_transcendence

Run everything with one command from this folder:
```sh
make up
```
Or run Compose directly in detached mode:
```sh
docker compose up --build -d
```
On this workstation, the installed CLI is the legacy Compose v1 binary, so the
equivalent command is:
```sh
docker-compose up --build -d
```
Detached mode is intentional. Legacy `docker-compose` v1 can crash its
foreground log watcher with newer Docker engines even though the containers are
healthy, and Ctrl+C in foreground mode stops the running app.

Avoid this foreground command on this workstation:
```sh
docker-compose up --build
```
For logs, run:
```sh
make logs
```
To stop everything:
```sh
make down
```
To install local dependencies, run checks, and build the Docker images:
```sh
make full
```
To stop the stack and remove generated local artifacts plus this Compose
project's local images and database volume:
```sh
make fclean
```
Website:
```text
http://localhost:3000
```
backend:
```text
http://localhost:8080
```

Seeded users are created on backend startup if they do not already exist:

```text
test / test
admin / admin
guest / guest
```