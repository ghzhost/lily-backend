# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Single error log line per failed request via pino-http `customProps` (#299)
- Event-loop lag percentile metrics via `perf_hooks` (#292)
- Fatal log + process exit on `server.listen` errors (#295)
- Constant-time API key comparison with `crypto.timingSafeEqual` (#287)
- Trimmed response headers from pino-http request logs (#294)

### Security
- API key validation now uses timing-safe comparison to prevent timing attacks (#287)

### Changed
- Error middleware no longer emits duplicate log entries; delegates to pino-http response logger (#299)

## [1.0.0] - 2026-05-16

### Added
- Initial release of Lily Protocol backend
- Health check endpoint (`GET /health`)
- Agent management endpoints (`GET /agents`, `POST /agents`)
- Pino HTTP request/response logging
- CORS and rate-limit configuration
- Zod schema validation for request bodies
- Docker support with multi-stage build
