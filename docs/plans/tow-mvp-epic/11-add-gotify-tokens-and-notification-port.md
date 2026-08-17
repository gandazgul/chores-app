---
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add per-user Gotify token storage, a safe settings surface, and a notification port with Gotify and no-op senders. Do not expose stored tokens in reads or logs."
affectedPaths:
  - "src/**/migrations/**"
  - "src/pages/api/users/**"
  - "src/pages/**"
  - "src/components/**"
  - "src/notifications/**"
  - ".env.example"
  - "tests/**"
executionAgent: "frontend-engineer"
collaborationRecommendation: "pair"
devServerCommand: "deno task dev"
devServerUrl: "http://127.0.0.1:8080"
devServerHmr: true
createdAt: "2026-08-10T16:07:52.359Z"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 11
dependencies:
  - "10-record-the-nag-policy-adr"
  - "06-restore-csrf-protection-for-browser-mutations"
planId: "4a8f2fec-cd40-4405-b703-e70904823fda"
updatedAt: "2026-08-17T18:11:35.985Z"
status: "ready_for_work"
userVerifiedAt: null
---

# Add Gotify Tokens and Notification Port

## Context

P3 needs a server-owned way to send a message to a member. Gotify details and
tokens must stay behind a port. Each member stores their own application token,
and a null token is a supported no-push state.

## Objective

Add secure Gotify token management for the signed-in member and a notification
port that can send through Gotify or log/no-op when `GOTIFY_URL` is absent.

## Approach

Add `users.gotify_token` through migration. Add settings UI and API routes that
let a member set, replace, and clear only their own token. Ensure no API returns
the stored token. Add a notification module that redacts secrets and chooses a
Gotify adapter only when configured. Use the CSRF protection from P1 for token
writes.

## Files to Modify

- `src/**/migrations/**` — add nullable `users.gotify_token`.
- `src/pages/api/users/**` or settings routes — add own-token set, replace, and
  clear mutations.
- `src/pages/**` and `src/components/**` — add minimal settings surface for
  Gotify token management.
- `src/notifications/**` — add notification port, Gotify adapter, and no-op or
  log sender.
- `src/pages/api/members/**` — expose only configured/not-configured state if
  member reads need it.
- `.env.example` — document `GOTIFY_URL` and local-development behavior.
- `tests/**` — cover token secrecy, own-user authorization, Gotify adapter
  behavior, no-op sender, and redacted errors.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `locals.user` and middleware session flow — bind token writes to the signed-in
  member.
- CSRF mutation boundary from `06-restore-csrf-protection-for-browser-mutations`
  — protect token writes.
- Existing API route style — use small server routes with clear JSON responses.
- Deno `fetch` — use it inside the Gotify adapter.

## Implementation Steps

- [ ] A migration adds nullable `users.gotify_token`.
- [ ] A signed-in member can store, replace, and clear their own Gotify token
      through the UI.
- [ ] Token write routes reject unauthenticated requests and reject attempts to
      write another member's token.
- [ ] No member-list response, settings response, or API error returns the
      stored token value.
- [ ] Logs and errors redact Gotify tokens and Gotify credentials.
- [ ] `GOTIFY_URL` selects the Gotify adapter; absence of `GOTIFY_URL` selects a
      no-op or log-only sender.
- [ ] The notification port sends messages with the `TOW: <title>` message
      format when using Gotify.
- [ ] HTTPS is required outside explicit local-development mode.
- [ ] Browser token mutations include the required CSRF or same-origin evidence.

## Verification Plan

- Automated: `deno task ci`.
- Automated: unit tests for notification port adapter selection, Gotify request
  shape, no-op behavior, redaction, and failure isolation.
- Automated: API tests for own-token set, replace, clear, and secrecy in reads.
- Manual headed browser check: run `deno task dev`, open
  `http://127.0.0.1:8080`, open settings, store a token, replace it, clear it,
  and confirm the page never displays the stored secret after save.
- Expected result: with no `GOTIFY_URL`, the app runs normally and attempts are
  logged or no-oped.

## Edge Cases & Considerations

- A null token is valid. Do not treat it as an account error.
- Pairing is recommended because this adds a settings UI and secret-handling
  affordances.
- Do not implement scheduler timing here. This child creates the send seam and
  token storage.
