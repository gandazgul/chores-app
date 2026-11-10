# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

The existing web app remains available during migration.

## Users

One household sharing recurring chores. Family members use the same server and
household data.

## Product Purpose

Tow supports steady household management through assigned chores and an
unassigned Pool. What's Next shows the signed-in member's next dated bucket;
Board shows all household work. Preserve existing recurrence, completion, skip,
Undo, and assignment semantics.

## Capabilities and Constraints

- Flutter Android client with the existing Astro/Deno/SQLite server.
- Google sign-in restricted to the household email allowlist.
- Direct native notifications through Firebase Cloud Messaging. The user reports
  Pushover is not working well and wants Tow to deliver reminders itself.
- The server owns recurrence, reminder scheduling, and household quiet hours.
- Existing Tow colors and terminology carry into Material 3 components.
- iPhone support is outside the current scope. Offline writes are not part of
  this migration; failures must be visible and retryable.

## Evidence on Hand

`docs/product-brief.md`, `docs/domain-language.md`, existing web components, and
server tests describe established behavior. `uno.config.js` contains the
incumbent colors. No Firebase project configuration has been supplied yet.
