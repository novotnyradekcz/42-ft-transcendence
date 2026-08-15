#!/bin/sh
set -e

if [ "$ENVIRONMENT" = "production" ]; then
    echo "[entrypoint] Production mode: using Let's Encrypt certificates"
    cp /etc/nginx/templates/nginx.production.conf /etc/nginx/conf.d/default.conf
else
    mkdir -p /etc/nginx/ssl
    # Browsers pin the "proceed anyway" exception to the cert, so making a new
    # one every boot meant re-accepting the warning after every rebuild. It is
    # valid for a year. Delete the volume if you want a fresh one.
    if [ -f /etc/nginx/ssl/local.crt ] && [ -f /etc/nginx/ssl/local.key ]; then
        echo "[entrypoint] Local mode: reusing existing self-signed certificate"
    else
        echo "[entrypoint] Local mode: generating self-signed certificate"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/local.key \
            -out /etc/nginx/ssl/local.crt \
            -subj "/CN=localhost/O=ft_transcendence/C=EU" \
            2>/dev/null
    fi
    cp /etc/nginx/templates/nginx.local.conf /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
