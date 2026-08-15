# ADR 0004: Google Sign-In verified once, then a self-issued session cookie

- **Status:** Accepted
- **Date:** 2026-08-10

## Context

The application needs to know which user owns which chores. It has no password
store and does not want one. The users are household members who already have
Google accounts.

A Google identity token is short-lived. If the application used it as the
session, the user would sign in again very often. The application also needs a
way to run locally and in end-to-end tests without a real Google account.

## Decision

Use Google Identity Services for sign-in, verify the Google token once on the
server, and then issue the application's own session token.

**Sign-in path**

1. `src/pages/login.astro` loads the Google Identity Services script and renders
   the Google button with `GOOGLE_CLIENT_ID`.
2. The browser posts the Google credential to `POST /api/auth/login`.
3. `verifyGoogleToken` in `src/utils/auth.ts` verifies the token against
   Google's remote JSON Web Key Set
   (`https://www.googleapis.com/oauth2/v3/certs`), and checks the issuer and the
   audience. The key set is fetched with `createRemoteJWKSet`, which caches
   keys.
4. `POST /api/auth/login` checks the verified email against `ALLOWED_EMAILS`.
   The list is comma-separated and case-insensitive. Empty entries are ignored.
   A missing or empty list denies all real Google accounts.
5. An allowed Google account is upserted into `users` by Google subject before a
   session is created. The row stores the current email and display name.
6. `createSession` signs a new JWT with `HS256` and the `SESSION_SECRET` secret.
   It expires after 30 days.
7. The route sets that token as a cookie named `session` with `httpOnly`,
   `sameSite=lax`, `path=/`, and a 30-day `maxAge`. `secure` is true unless
   `COOKIE_SECURE` is the string `false`.

`GET /api/auth/logout` deletes the cookie and redirects to `/login`.

**Enforcement path**

`src/middleware.ts` runs on every request. It reads the `session` cookie,
verifies it with the shared secret, and checks the Session email against the
current `ALLOWED_EMAILS` value. It puts the User on `context.locals.user`, or
`null`. If a cookie exists but no longer resolves to a User, the middleware
removes the `session` cookie with `path=/`. It then applies two redirects: an
unauthenticated request to a non-public route goes to `/login`, and an
authenticated request to `/login` goes to `/`. The public routes are `/login`,
`/api/auth/login`, and `/api/auth/logout`.

**Development and test bypass**

When `ENABLE_AUTH` is exactly the string `false`, the middleware skips all
verification and puts a fixed mock user on `context.locals.user`. Any other
value, including a missing value, enforces authentication. `COOKIE_SECURE`
follows the same rule: only the exact string `false` turns secure cookies off.

## Consequences

**Good**

- No password storage and no credential reset flow.
- One place, the middleware, decides whether a request is authenticated. Pages
  and API routes only read `locals.user`.
- The session survives for 30 days without a call to Google on each request.
- Removing an email from `ALLOWED_EMAILS` blocks that Session on its next
  request after the process sees the changed environment.
- The end-to-end tests run against a real server with a real user identity,
  without a Google account.

**Bad or limiting**

- The session token is self-contained and is not stored on the server. Logout
  only deletes the cookie in that browser. A copied token is blocked only when
  its email leaves `ALLOWED_EMAILS` or when it expires.
- `ALLOWED_EMAILS` is fail-closed. If authentication is enabled and the variable
  is missing or empty, no real Google account can sign in or keep a Session.
- A 30-day lifetime is long for a token that cannot be revoked.
- The insecure defaults are only one environment variable away.
  `ENABLE_AUTH=false` disables all authentication and serves the mock user's
  chores to anyone. This value must never be set in production.
- `SESSION_SECRET` is read at call time and throws if missing. The application
  starts and fails per request instead of refusing to start.
