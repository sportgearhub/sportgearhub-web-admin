# Sportgearhub Web Admin

Internal admin web app built with React, TypeScript, and Vite.

## Local Development

```bash
npm ci
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Integration

See [docs/integration.md](docs/integration.md) for API wiring and admin-specific auth payloads.

The OIDC client id for this app is:

```text
sportgearhub-web-admin
```

## Deployment

Production deployment follows the provider app pattern: pushing the `production` branch triggers GitHub Actions to build the Vite app, publish a GHCR Docker image, upload `docker-compose.yml` to the target server, and restart Docker Compose under `/opt/sportgearhub-web-admin`.

Required production configuration is documented in [docs/deployment.md](docs/deployment.md). The workflow requires `DEPLOY_HOST`, `DEPLOY_USER`, `VITE_API_BASE_URL`, and `DEPLOY_SSH_KEY`; `VITE_OIDC_CLIENT_ID` defaults to `sportgearhub-web-admin` and must not be changed for production.
