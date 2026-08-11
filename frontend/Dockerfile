FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Debian-based nginx: ships the openssl CLI that docker-entrypoint.sh needs for
# the local self-signed certificate. The alpine variant does not, and installing
# it would require reaching the Alpine mirror during the build.
FROM nginx:1.29

COPY nginx.local.conf      /etc/nginx/templates/nginx.local.conf
COPY nginx.production.conf /etc/nginx/templates/nginx.production.conf
COPY docker-entrypoint.sh  /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
