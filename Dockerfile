FROM nginx:1-alpine AS base
COPY ["nginx.conf", "/etc/nginx/conf.d/default.conf"]
RUN apk add gettext
COPY ["nginx.startup.sh", "/startup.sh"]

FROM base AS publish
WORKDIR /usr/share/nginx/html
COPY ./dist/floppybot-soundboard/ .
CMD ["sh", "/startup.sh"]
EXPOSE 80
