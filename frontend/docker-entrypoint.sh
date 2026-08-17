#!/bin/sh
set -e

if [ "$ENVIRONMENT" = "production" ]; then
    echo "[entrypoint] Production mode: using Let's Encrypt certificates"
    cp /etc/nginx/templates/nginx.production.conf /etc/nginx/conf.d/default.conf
else
    echo "[entrypoint] Local mode: generating self-signed certificate"
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/local.key \
        -out /etc/nginx/ssl/local.crt \
        -subj "/CN=localhost/O=ft_transcendence/C=EU" \
        2>/dev/null
    cp /etc/nginx/templates/nginx.local.conf /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
