#!/bin/sh
NGINX_DIR=/usr/share/nginx/html
envsubst < "${NGINX_DIR}/assets/env.template.js" > "${NGINX_DIR}/assets/env.js" && nginx -g 'daemon off;'
