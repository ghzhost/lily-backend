# Lily Backend API Reference

Base URL: `http://localhost:3000` (default)

All responses follow the standard envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses use the same envelope with `success: false` and include structured error details.

---

## Health

### `GET /health`

Returns service health status including uptime, memory usage, and build metadata.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 12345.67,
    "timestamp": "2026-09-04T03:00:00.000Z",
    "memory": { "rss": 52428800, "heapUsed": 31457280 },
    "build": { "version": "1.0.0", "node": "v22.x" }
  }
}
```

---

## Agents

### `GET /agents`

List all registered agents.

**Response:**
```json
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "agentlily_demo_001",
        "name": "Treasury Settlement Agent",
        "description": "Demonstration AgentLily responsible for mock treasury settlement workflows.",
        "walletAddress": "GBLILYDEMOSETTLEMENTWALLET000000000000000000001",
        "status": "active",
        "capabilities": ["wallet-provisioning", "usdc-payments", "settlement"],
        "createdAt": "2026-05-16T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

### `POST /agents`

Create a new agent.

**Request Body:**
```json
{
  "name": "string (2-80 chars)",
  "description": "string (10-280 chars)",
  "capabilities": ["string (2-50 chars each)", "min 1, max 10"]
}
```

**Validation:** Enforced via Zod schema. Returns 400 with details on failure.

**Response (201):**
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "agentlily_2",
      "name": "New Agent",
      "description": "...",
      "walletAddress": "GNEWAGENT0000000000000000000000000000000000000000000000",
      "status": "active",
      "capabilities": ["..."],
      "createdAt": "2026-09-04T03:00:00.000Z"
    }
  }
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP listen port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `LOG_LEVEL` | No | `info` | Pino log level |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window in ms |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `API_KEY` | Yes (prod) | — | Bearer token for authenticated endpoints |

---

## Error Handling

All errors return a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": {}
  }
}
```

Each failed request produces exactly one log line via pino-http with full error context attached.
