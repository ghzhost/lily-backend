# Lily Backend v1 API — Full Endpoint Surface

Base path: `/api/v1` (configurable via `API_PREFIX`)

All responses use the standard envelope `{ success: boolean, data?: ..., error?: ... }`.

---

## Health

### `GET /health`

Returns service health status.

**Authentication:** None

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "Lily Backend",
    "environment": "production",
    "timestamp": "2026-09-04T03:00:00.000Z"
  }
}
```

---

## Agents

### `GET /agents`

List all registered agents.

**Authentication:** None (read-only)

**Response 200:**
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

**Authentication:** Required (`Authorization: Bearer <API_KEY>`) when `API_KEY` is configured.

**Request Body:**
| Field | Type | Constraints |
|---|---|---|
| `name` | string | 2–80 characters |
| `description` | string | 10–280 characters |
| `capabilities` | string[] | 1–10 items, each 2–50 characters |

**Example Request:**
```json
{
  "name": "Payment Reconciliation Agent",
  "description": "Automated agent for reconciling incoming USDC payments against invoice records.",
  "capabilities": ["payment-matching", "invoice-reconciliation", "reporting"]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "agent": {
      "id": "agentlily_2",
      "name": "Payment Reconciliation Agent",
      "description": "Automated agent for reconciling incoming USDC payments against invoice records.",
      "walletAddress": "GPAYMENTRECONCILIATIONAGENT0000000000000000000000000",
      "status": "active",
      "capabilities": ["payment-matching", "invoice-reconciliation", "reporting"],
      "createdAt": "2026-09-04T03:00:00.000Z"
    }
  }
}
```

**Validation Errors (400):**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "statusCode": 400,
    "details": {
      "name": "String must contain at least 2 character(s)",
      "capabilities": "Array must contain at least 1 element(s)"
    }
  }
}
```

---

## Error Responses

All endpoints return errors in a consistent format:

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

Common status codes:
- **400** — Validation failure or malformed request
- **401** — Missing or invalid API key
- **404** — Resource not found
- **429** — Rate limit exceeded
- **500** — Internal server error

Each failed request produces exactly one structured log line via pino-http with full error context (#299).
