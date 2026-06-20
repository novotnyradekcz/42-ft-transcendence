FROM rust:1.95-bookworm AS build

WORKDIR /app

COPY Cargo.toml Cargo.lock diesel.toml ./
COPY migrations ./migrations
COPY src ./src

RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/release/server /app/server

EXPOSE 8080
CMD ["/app/server"]
