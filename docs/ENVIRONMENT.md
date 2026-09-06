# Environment Variables & API Key Configuration

This document describes all environment variables used by Lily Backend and how to configure API key authentication.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `test`, `production`) |
| `PORT` | No | `4000` | HTTP listen port (1–65535) |
| `APP_NAME` | No | `Lily Backend` | Application name used in logging and metadata |
| `API_PREFIX` | No | `/api/v1` | URL prefix for all API routes |
| `LOG_LEVEL` | No | `info` | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `BODY_SIZE_LIMIT` | No | `1mb` | Maximum request body size (e.g., `1mb`, `500kb`) |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate limit window duration in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Maximum requests per rate limit window per IP |
| `TRUST_PROXY` | No | `false` | Whether to trust reverse proxy headers (`true`/`false`) |
| `API_KEY` | Yes (prod) | — | Bearer token for authenticated endpoints |

## Configuration

### Development

Create a `.env` file in the project root:

```bash
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
API_KEY=dev-api-key-for-local-testing-only
```

The server validates all environment variables at startup using Zod schemas. Invalid values will prevent the server from starting with a descriptive error message.

### Production

Set environment variables through your deployment platform (Docker env, Kubernetes secrets, systemd EnvironmentFile, etc.). At minimum, production deployments should set:

```bash
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
CORS_ORIGINS=https://your-domain.com
API_KEY=<strong-random-token>
RATE_LIMIT_MAX_REQUESTS=100
TRUST_PROXY=true  # if behind nginx/Caddy/cloudflare
```

## API Key Authentication

### How It Works

Authenticated endpoints require a valid `API_KEY` via the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

The comparison uses `crypto.timingSafeEqual` to prevent timing attacks (#287). Requests without a valid key receive a `401 Unauthorized` response.

### Generating a Secure API Key

Generate a cryptographically strong key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Store the generated key securely (e.g., vault, secrets manager). Never commit it to version control.

### Unauthenticated Endpoints

The following endpoints do **not** require an API key:
- `GET /health` — Health check
- `GET /agents` — List agents (read-only)

All mutation endpoints (`POST`, `PUT`, `DELETE`) require authentication when `API_KEY` is configured.

## Validation

Environment variables are validated at startup against a Zod schema. If validation fails, the process exits with a clear error listing all invalid fields. This prevents silent misconfigurations in production.

Example error output:

```
Invalid environment configuration: PORT: Number must be greater than or equal to 1, LOG_LEVEL: Invalid enum value
```
