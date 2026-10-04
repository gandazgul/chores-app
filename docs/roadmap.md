# Roadmap

_Last revised: 2026-10-04_

## Where We Are

The household MVP is implemented: Google sign-in with an email allowlist and
persisted members; shared chore CRUD; assignment, claim and release; What's
Next, Board and Pool; fuzzy search; recurrence; transactional completion and
Skip/Undo; per-member Gotify tokens; assigned nags and optional Pool Blast;
forward-only SQLite migrations; TypeScript source and tests.

Deployment preparation now includes a pinned Deno image with cached runtime
dependencies, configurable `DB_PATH`, an HTTPS `PUBLIC_ORIGIN` CSRF boundary,
startup configuration validation, `/healthz`, graceful HTTP shutdown, and
consistent SQLite backup snapshots. The neighboring `k8s-infrastructure`
repository contains the Tow overlay for `todo.dumbhome.uk`: one replica with
Recreate updates, YASR persistence, sealed credentials, health probes, and a
nightly backup to the backup volume.

Release validation passes 126 unit/integration tests, 17 browser tests, and the
production container lifecycle test against the x86-64 release image. The latter
covers fresh/legacy migrations, backup restoration, pending-delivery recovery,
HTTPS-origin checks, and a read-only root filesystem. GitHub Actions gates image
publication on these checks.

The remaining acceptance checks require the real deployment and account:
Google's authorized origin, Google sign-in, a member's Gotify application token,
and notification receipt on their phone. See README for deployment and restore
procedures. Fuzzy scheduling and quota recurrence remain future product work.

The milestones below preserve the original product direction. P0, P1 and P3 were
implemented by the completed Tow MVP epic; they are not an outstanding
implementation checklist.

---

## What's Next

### Settled product principles

These decisions frame every milestone below.

- **The instance is the household.** This app is self-hosted over SQLite; one
  deployment serves one home. There is no `households` table and nothing to
  seed. Every user in the `users` table is a member. The home's name is a
  display string (default "My Home"). A second household is a second deployment,
  not a schema change.
- **Permissions are flat.** No roles in the MVP. Anyone can edit, delete,
  complete, or reassign anything. Assignment is a routing concept, not an
  authority one.
- **Assignment has exactly two paths:** direct assign to a person, or self-claim
  from the pool.
- **The unassigned pool is an inbox, not a home.** It holds up-for-grabs, fuzzy,
  and collaborative work — but items are meant to move out of it, not live
  there.
- **The right to interrupt is earned by assignment.** Assigned chores get push
  notifications. The pool gets ambient pressure — visible when you open the app,
  with at most one server-configurable blast as a due date nears.

### P0 — Housekeeping and foundations

Clears the ground before the first real schema change.

1. New Google users cannot create a chore. chores.user_id has a foreign key to
   users (id), and no code path ever inserts a users row. Only the seeded mock
   user works. In ADR 0004.
2. Completion is not transactional and un-completing is lossy. Marking a
   recurring chore done runs three separate statements with no transaction, and
   toggling it back to not-done leaves the spawned occurrence in place while the
   cleared recurrence is never restored — the chore silently stops recurring. In
   ADR 0005.

- completion_logs currently stores id, chore_id, completed_at. It records that a
  chore got done, but not what it was due at the time, so the log does not
  record which due date it closed.

  That's a one-column addition, and P0 is already building the migration
  mechanism, so it costs almost nothing to fold in. Do it and every completion
  from that day forward silently accumulates the evidence of whether the nag
  works. Skip it and you'll be asking "is this helping?" with no way to answer.
  Nice little rung.

- Establish a **migration mechanism**. This is the prerequisite for everything
  in P1; without it, adding a column strands every existing database.
- Keep generated SQLite database files out of git — a stale-schema database in
  git is actively dangerous the day migrations begin.
- Fold in any documentation corrections discovered while implementing the P0
  changes.
- **Rename the product to Tow.** Settled 2026-08-10 — see
  [product-brief.md](product-brief.md#identity). Touches `public/manifest.json`,
  `src/layouts/Layout.astro`, `src/pages/login.astro`, `README.md`, and the icon
  assets. It belongs in P0 rather than later for one reason: P1 puts a second
  person's PWA on a home screen, and an installed app's name and icon are
  awkward to change afterward. Cheap now, annoying later. The implementing
  change should also close the "Product name" entry under _Open Language
  Questions_ in `domain-language.md`, since that answer only becomes true when
  the code says Tow.

### P1 — Household

The bulk of this milestone is **user provisioning**, not the assignment feature.
The app currently cannot support a second person at all.

- **Persist users on login.** Upsert the user row when a Google token verifies.
  Defuses the foreign-key failure.
- **Gate who may log in.** Default approach: an env-var allowlist of permitted
  Google emails, checked before minting the session. Zero UI, fits self-hosting,
  closes the open door. _(Open alternative: an in-app invite flow. This is a
  swap, not a redesign.)_
- **Drop owner-scoped visibility.** Remove the `WHERE user_id = ?` filter;
  `user_id` becomes "who created it" rather than "who can see it."
- **Add an assignee**, with **assign** and **claim** as first-class actions.
- **Edit and delete UI.** Folded in here rather than a separate milestone,
  because P1 rewrites the modal and the visibility rules anyway. Shared chores
  make missing edit unacceptable — someone else's typo must be fixable.
- **"What's next" landing view:** my assigned chores due today, falling back to
  the nearest due date when nothing is due. The full board becomes a deliberate
  second view, not the default.

### P3 — Notifications

The differentiator. The nag cadence, escalation ladder, quiet-hours behavior,
slot identity, and one Pool blast are the policy source in
[ADR 0007](adr/0007-nag-cadence-escalation-and-quiet-hours.md).

- Per-user Gotify tokens. Gotify is multi-user — one server, one account per
  household member — so each member stores their own application token. This is
  a configuration detail, not a feasibility risk.
- The nag engine for assigned chores: persistent reminders until the chore is
  resolved, using the ADR 0007 ladder. The reserved `remind_until_done` and
  `notification_sent_at` columns become live here.
- **Skip**, folded in here rather than treated as a list feature. Skip is nag
  dismissal semantics — a reminder you can only silence by falsely claiming
  "done" is a broken reminder.
- **The pool nudge.** Ambient in-app pressure plus the one due-date blast
  defined by ADR 0007.
  - Design constraint worth banking now: an inbox's health signal is **age, not
    due date**. The items the pool is meant to hold — fuzzy, undefined,
    collaborative — are precisely the ones least likely to carry a due date, so
    a due-date-driven nudge would stay silent about the items most at risk of
    rotting. The nudge should key off how long an item has sat unclaimed, with
    the due-date blast as a separate, sharper escalation on top.

### P4 — Fuzzy scheduling

This label covers two features, and P3 partially absorbs one of them.

- **Fuzzy due windows** ("first week of June," "week 30," "sometime this
  month"). Close to "start nagging on X, escalate toward Y," which P3 has to
  decide regardless. Expect this to shrink or disappear into P3.
- **Quota-based recurrence** ("twice a week, any days"; "4× a day walk the
  dogs"). The genuinely hard, genuinely separate piece: `rrule` emits specific
  datetimes, but a quota describes a count over a period. This is a second
  scheduling concept, not a variation on the first, and it deserves its own
  design round when reached.

### Deferred / unscheduled

- **Roles** (parent → child authority, contested completions, local non-Google
  accounts for children). Explicitly a v2 problem.
- **`priority`** — decide whether to surface it or drop the column.
