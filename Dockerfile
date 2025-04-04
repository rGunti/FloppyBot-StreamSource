# === Base Images =========================================
# --- Node.js Build Base Image ----------------------------
# --- Nginx Base Image ------------------------------------
FROM nginx:1-alpine AS base
COPY ["nginx.conf", "/etc/nginx/conf.d/default.conf"]
RUN apk add gettext
COPY ["nginx.startup.sh", "/startup.sh"]

# === Publish Application =================================
FROM base AS publish
WORKDIR /usr/share/nginx/html
COPY ./dist/floppybot-soundboard/browser/ .
CMD ["sh", "/startup.sh"]
EXPOSE 80
