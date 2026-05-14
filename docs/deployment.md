# Deployment

Production is deployed by GitHub Actions when the `production` branch is updated. The workflow builds `dist`, builds and pushes a Docker image to GHCR, uploads `docker-compose.yml` to the target host, and starts Docker Compose under `/opt/sportgearhub-web-admin`.

The Docker image uses `ghcr.io/static-web-server/static-web-server:2`, a static server image. It serves only `dist` and uses `/public/index.html` as the SPA fallback page.

The image includes `sws.toml` so SPA HTML and fallback routes are served with no-cache headers. Hashed assets under `/assets` remain cacheable for one year with `immutable`.

The frontend has a runtime production fallback to `https://api.sportgearhub.ru` when it is served from `admin.sportgearhub.ru`, but the GitHub variable should still be set so the built asset is explicit.

Published image:

```text
ghcr.io/sportgearhub/sportgearhub-web-admin:production
```

Required GitHub variables:

- `DEPLOY_HOST`: target server host or IP
- `DEPLOY_USER`: SSH user on the target server
- `VITE_API_BASE_URL`: API origin used by the built frontend, normally `https://api.sportgearhub.ru`

Required GitHub secret:

- `DEPLOY_SSH_KEY`: private SSH key for the deploy user

Optional GitHub variables:

- `DEPLOY_PORT`: SSH port, defaults to `22`
- `APP_DIR`: target app directory, defaults to `/opt/sportgearhub-web-admin`
- `WEB_ADMIN_IMAGE`: Docker image tag, defaults to `production`
- `VITE_OIDC_CLIENT_ID`: OIDC client id used by the built frontend, defaults to `sportgearhub-web-admin`

Production builds must use this OIDC client id:

```text
sportgearhub-web-admin
```

The deploy user must be able to write to `/opt/sportgearhub-web-admin` and run Docker Compose. The target host must have an external Docker network named `apps-proxy` so Nginx can proxy to the app container. The target host must also be able to pull `ghcr.io/sportgearhub/sportgearhub-web-admin:production`.

Create the proxy network once on the target host if it does not exist:

```sh
docker network create apps-proxy
```

The Nginx container must also be attached to this network. If it is already running:

```sh
docker network connect apps-proxy sportgearhub-nginx
docker restart sportgearhub-nginx
```

If Nginx is managed by Compose, add the same external `apps-proxy` network to the Nginx compose file instead.

Manual server deployment is still possible after the image is available in GHCR:

```sh
cd /opt/sportgearhub-web-admin
docker compose pull
docker compose up -d --remove-orphans
```

If the host uses legacy Compose, run:

```sh
docker-compose pull
docker-compose up -d --remove-orphans
```

The Docker service and container name are `sportgearhub-web-admin`.

From Nginx on the same Docker network, set `ADMIN_UPSTREAM` to `http://sportgearhub-web-admin:80`.

Set `WEB_ADMIN_IMAGE` to change the deployed image tag. Use a tag value such as `production` or `latest`; the Compose file expands it to `ghcr.io/sportgearhub/sportgearhub-web-admin:<tag>`.
