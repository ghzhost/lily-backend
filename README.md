# Lily Backend

[![CI](https://github.com/lily-protocol/lily-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/lily-protocol/lily-backend/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

Backend service for Lily Protocol, the autonomous agent finance infrastructure for AI agents on Stellar.

This repository is the backend foundation for provisioning agent-facing services, exposing developer APIs, validating requests, and supporting modular protocol features such as wallets, payments, agent identity, and orchestration flows.

## Highlights

- Express backend with strict TypeScript
- Modular feature structure for contributor-friendly development
- Zod-powered environment and request validation
- Security middleware with Helmet, CORS allowlist, and rate limiting
- Structured logging with Pino
- Automated lint, build, and test checks in GitHub Actions
- Docker-ready local and deployment workflow

## Docker

The production Docker image runs as the `node` user (non-root) for security. The `Dockerfile` uses the `--chown=node:node` flag on `COPY` instructions so the `node` user owns all application files. It also defines a `HEALTHCHECK` instruction probing `/api/v1/health/live` using Node.js's built-in `fetch`, respecting the configured `PORT` (default 4000). No additional configuration is needed.

## Tech Stack

- Node.js 22
- Express 5
- TypeScript
- Zod
- Vitest and Supertest
- Docker
- GitHub Actions

## Quick Start

```bash
npm install
npm run dev
```

The repo already includes a local `.env` for development. If you want to recreate it manually:

```bash
cp .env.example .env
```

The server runs on `http://localhost:4000` by default.

## Available Endpoints

- `GET /`
- `GET /api/v1/health`
- `GET /api/v1/agents`
- `POST /api/v1/agents`
- `POST /api/v1/payments/quote`

All `/api/v1` responses send `Cache-Control: no-store` so dynamic agent and
payment data is not cached by clients or shared proxies. The root route is a
basic service metadata response and is kept outside this API cache policy.

## Example API

The sample `agents` module shows contributors how to structure backend features:

- route registration
- request validation with Zod
- typed controllers and responses
- service-layer business logic
- module-local TypeScript types

Example request:

```bash
curl -X POST http://localhost:4000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payments Runner",
    "description": "AgentLily responsible for autonomous USDC payment execution.",
    "capabilities": ["payments", "marketplace-purchases"]
  }'
```

`POST /api/v1/agents` accepts only `name`, `description`, and `capabilities`.
Unknown payload keys are rejected with validation field errors.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run audit:prod
npm run format
npm run test
npm run test:coverage
npm run check
```

## Project Structure

```text
src/
  common/
  config/
  modules/
    agents/
    health/
    payments/
  routes/
  app.ts
  server.ts
tests/
```

## Docker

```bash
docker build -t lily-backend .
docker run --env-file .env -p 4000:4000 lily-backend
```

## Quality Standards

Every contribution is expected to pass:

```bash
# Run full local verification gate
npm run check

# Or run individual checks
npm run lint
npm run typecheck
npm run audit:prod
npm run build
npm run test:coverage
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines and local setup details.

## API Versioning Strategy

This backend uses **URL path versioning** as its primary API versioning mechanism.

- All endpoints are mounted under `/api/v1/` (configurable via `API_PREFIX` env var)
- When breaking changes are required, a new version module (`v2`) will be created and mounted alongside `v1`
- The existing `v1` routes will continue to serve existing clients without modification
- New major versions are introduced only for breaking changes; additive changes land in the current version
- Deprecation of old versions follows a minimum 6-month notice period documented in the [changelog](./CHANGELOG.md) and release notes

### Adding a New API Version

1. Create `src/routes/v2/index.ts` with the new router
2. Mount it in `src/app.ts`: `app.use("/api/v2", apiV2Router)`
3. Keep `v1` routes unchanged for backward compatibility
4. Replace the placeholder [v1-to-v2 migration guide](./docs/migration/v1-to-v2.md) with concrete consumer instructions
5. Announce the deprecation timeline in the [changelog](./CHANGELOG.md)
