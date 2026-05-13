# Sportgearhub Web Admin Console

Internal admin console built with React, TypeScript, and Vite.

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

## Deployment

Production deployment follows the provider app pattern: pushing the `production` branch triggers GitHub Actions to build the Vite app, publish a GHCR Docker image, upload `docker-compose.yml` to the target server, and restart Docker Compose under `/opt/sportgearhub-web-admin`.

See [docs/deployment.md](docs/deployment.md) for the required GitHub variables, target host setup, and manual deployment commands.
