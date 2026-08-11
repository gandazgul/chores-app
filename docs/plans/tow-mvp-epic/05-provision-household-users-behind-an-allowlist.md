---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Persist a user row on successful Google login and block non-allowlisted accounts before session creation. Preserve the current session JWT flow and the mock-user bypass."
affectedPaths:
    - "src/pages/api/auth/login.*"
    - "src/middleware.*"
    - "src/utils/auth.*"
    - "src/**/migrations/**"
    - ".env.example"
    - "tests/**"
executionAgent: "engineer"
createdAt: "2026-08-10T16:07:51.677Z"
updatedAt: "2026-08-10T16:07:51.677Z"
status: "draft"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 5
dependencies:
    - "02-add-forward-only-startup-migrations"
---

# Provision Household Users Behind an Allowlist

## Context

The current Google login path verifies an ID token and mints a session cookie, but it does not insert a `users` row. A second real user can hit foreign-key failures later. The Epic also requires an `ALLOWED_EMAILS` gate.

## Objective

On successful allowed login, create or update the `users` row with Google subject, email, and display name. Reject non-allowlisted Google accounts before user upsert and session creation. Keep `ENABLE_AUTH=false` behavior unchanged.

## Approach

Add a migration for `users.name`. Put the allowlist check after Google token verification and before database upsert and session minting. Parse `ALLOWED_EMAILS` as comma-separated, case-insensitive emails. Prefer the Epic recommendation to re-check the allowlist in middleware for active sessions.

## Files to Modify

- `src/**/migrations/**` — add `users.name`.
- `src/pages/api/auth/login.*` — check allowlist, upsert user, and mint session only on success.
- `src/middleware.*` — re-check session email against the allowlist when auth is enabled, unless this plan records an accepted limitation.
- `src/utils/auth.*` — ensure session user payload includes the fields needed for allowlist checks and user provisioning.
- `.env.example` — document `ALLOWED_EMAILS`; trim or annotate unused auth-related env vars if still present.
- `tests/**` — cover allowed login, rejected login, mock-user bypass, and middleware re-check behavior.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/utils/auth.*` — preserve Google ID-token verification and self-issued session JWT creation.
- `src/middleware.*` — preserve redirect rules and mock-user bypass.
- Migration system from `02-add-forward-only-startup-migrations` — add schema changes through normal migrations.

## Implementation Steps

- [ ] A migration adds `users.name` without losing existing users.
- [ ] A verified Google account whose email is in `ALLOWED_EMAILS` gets a `users` row with id, email, and display name before the session cookie is set.
- [ ] A non-allowlisted Google account receives 401, no session cookie, and no `users` row.
- [ ] Email matching is case-insensitive and trims whitespace around comma-separated values.
- [ ] `ENABLE_AUTH=false` still serves the mock user and does not require Google or allowlist configuration.
- [ ] Middleware re-checks the session email against `ALLOWED_EMAILS`, or the plan records the accepted limitation that de-listing waits for token expiry.
- [ ] The current Google ID-token sign-in flow and 30-day self-issued session cookie remain intact.

## Verification Plan

- Automated: `deno task ci`.
- Automated: tests with stubbed Google verification cover allowed, rejected, and malformed allowlist cases.
- Automated: tests cover that successful login upserts the user and rejected login does not.
- Automated: tests cover `ENABLE_AUTH=false` mock user behavior.
- Expected result: a second allowlisted account can sign in and later create a chore without a foreign-key failure.

## Edge Cases & Considerations

- Session tokens are self-contained. A login-only allowlist gate cannot revoke active sessions; middleware re-check is recommended.
- Do not change the provider or add a server-side Google code exchange.
- Keep secrets out of logs when login fails.