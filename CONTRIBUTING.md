# Contributing

Thanks for considering a contribution to Lily Protocol.

## Local setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start the development server with `npm run dev`.

## Quality checks

Before opening a pull request, run the full verification gate:

```bash
npm run check
```

Or run the individual stages:

```bash
npm run lint
npm run typecheck
npm run audit:prod
npm run build
npm run test
```

`npm run check` mirrors the GitHub Actions CI workflow (lint, typecheck, audit, build, test with coverage) and exits non-zero if any stage fails, so a passing `npm run check` is a strong signal the CI run will pass.

## Contribution guidelines

- Keep changes focused and modular.
- Add or update tests when behavior changes.
- Prefer small pull requests with a clear description.
- Open an issue first for major architectural changes.
- Follow the module pattern used in `src/modules/agents` for new features.
