#!/bin/sh
# Creates server/.env from server/.env.example and fills in the values that
# have to exist but whose content is arbitrary: the two secrets and the local
# database connection.
#
# Refuses to touch an existing .env — it holds credentials that cannot be
# regenerated, and overwriting SECRET_HASH invalidates every session cookie.
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
example="$repo_root/server/.env.example"
target="$repo_root/server/.env"

[ -f "$example" ] || {
    echo "error: $example not found" >&2
    exit 1
}

if [ -e "$target" ]; then
    echo "server/.env already exists, leaving it alone."
    echo "Delete it first if you want a fresh one."
    exit 0
fi

command -v openssl >/dev/null 2>&1 || {
    echo "error: openssl is required to generate the secrets" >&2
    exit 1
}

# 64 hex characters each. For SECRET_HASH that length is a requirement, not a
# preference: it signs the OAuth session cookie, and cookie::Key::from panics
# on anything shorter than 64 bytes.
secret_hash=$(openssl rand -hex 32)
jwt_hash=$(openssl rand -hex 32)

# Matches the credentials docker-compose.yml gives the db service. The server
# container receives DATABASE_URL from compose and ignores this one; it is
# what a host-side `cargo run` or `cargo test` uses to reach the same database
# through the published port.
database_url="postgres://postgres:postgres@localhost:5432/ft_transcendence"
database_password="postgres"

umask 077 # the file is about to hold secrets

sed \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=$database_url|" \
    -e "s|^DATABASE_PASSWORD=.*|DATABASE_PASSWORD=$database_password|" \
    -e "s|^SECRET_HASH=.*|SECRET_HASH=$secret_hash|" \
    -e "s|^JWT_HASH=.*|JWT_HASH=$jwt_hash|" \
    "$example" >"$target"

echo "Created server/.env"
echo
echo "Filled in:   DATABASE_URL, DATABASE_PASSWORD, SECRET_HASH, JWT_HASH"
echo "Left blank:  OAUTH_*_CLIENT_ID and OAUTH_*_CLIENT_SECRET"
echo
echo "Register an application with each provider you want to offer and paste"
echo "its credentials in. Providers left blank simply do not appear in the"
echo "sign-in menu, so the server runs fine without any of them."
