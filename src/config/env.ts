import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

export const trustProxySchema = z.preprocess(
  (val) => (val === undefined || val === "" ? "false" : val),
  z.union([
    z.literal("false").transform(() => false as const),
    z.literal("true").refine(() => false, {
      message:
        "TRUST_PROXY=true is unsafe in production; use a specific hop count or 'loopback'",
    }),
    z
      .string()
      .regex(/^\d+$/, {
        message:
          "TRUST_PROXY must be 'false', a positive integer hop count, or 'loopback'",
      })
      .transform((v) => parseInt(v, 10)),
    z.literal("loopback"),
  ]),
);

// RFC 9110 field names use the `token` character set. Rejecting operational
// headers as API-key carriers also prevents the auth middleware from
// reinterpreting headers that Express or another middleware already owns.
const HTTP_FIELD_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const RESERVED_API_KEY_HEADERS = new Set([
  "authorization",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "idempotency-key",
  "proxy-authorization",
  "set-cookie",
  "transfer-encoding",
  "x-request-id",
]);

export const authApiKeyHeaderSchema = z
  .string()
  .min(1)
  .regex(HTTP_FIELD_NAME_PATTERN, {
    message: "AUTH_API_KEY_HEADER must be a valid HTTP header field name",
  })
  .refine((header) => !RESERVED_API_KEY_HEADERS.has(header.toLowerCase()), {
    message: "AUTH_API_KEY_HEADER conflicts with a reserved HTTP header",
  })
  .default("x-api-key");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_NAME: z.string().min(1).default("Lily Backend"),
  BUILD_COMMIT: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  API_PREFIX: z.string().min(1).default("/api/v1"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGINS: z.string().min(1).default("http://localhost:3000"),
  BODY_SIZE_LIMIT: z.string().min(1).default("1mb"),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  AUTH_API_KEY: z.string().optional(),
  AUTH_API_KEY_HEADER: authApiKeyHeaderSchema,
  TRUST_PROXY: trustProxySchema,
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.flatten().formErrors.join(", ")}`,
  );
}

export const env = parsedEnv.data;

export const securityConfig = {
  allowedOrigins: env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  bodySizeLimit: env.BODY_SIZE_LIMIT,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  trustProxy: env.TRUST_PROXY,
  authApiKey: env.AUTH_API_KEY,
  authApiKeyHeader: env.AUTH_API_KEY_HEADER,
};
