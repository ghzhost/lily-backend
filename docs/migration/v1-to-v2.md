# Migrating from API v1 to v2

> Status: Placeholder. API v2 has not been introduced yet.

This guide reserves the migration path for the next breaking API version. Until
v2 is implemented, `/api/v1` remains the current and supported API surface.

## Maintainer process

1. Create the v2 router in `src/routes/v2/index.ts`.
2. Mount it at `/api/v2` in `src/app.ts` alongside the existing v1 router.
3. Keep the v1 routes unchanged for backward compatibility while additive,
   non-breaking changes continue to land in v1.
4. Replace this placeholder with concrete consumer migration steps, document a
   minimum six-month v1 deprecation timeline in the [changelog](../../CHANGELOG.md),
   and announce the breaking changes in release notes.

## Consumer migration checklist

The completed guide for a real v2 release must identify:

- the affected v1 endpoints and their v2 replacements;
- every request, response, authentication, and error-contract change;
- side-by-side request and response examples;
- the first v2 release containing each change;
- the v1 deprecation date and final removal date; and
- a rollback or compatibility strategy for consumers migrating gradually.

No v1 endpoint should be removed before the documented deprecation window has
elapsed.
