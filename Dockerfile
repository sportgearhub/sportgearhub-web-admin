FROM ghcr.io/static-web-server/static-web-server:2

COPY dist /public

ENV SERVER_ROOT=/public
ENV SERVER_FALLBACK_PAGE=/public/index.html
ENV SERVER_LOG_LEVEL=warn

EXPOSE 80
