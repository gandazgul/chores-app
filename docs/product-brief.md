# Product Brief

_Last revised: 2026-08-10_

This is the foundational product document for **Tow**, the household chore app
previously carrying the working title "Chores App." It states who the app is
for, what job it does, the principles that bound it, and what "done" looks like.
It supersedes and replaces the former `projectbrief.md` and `productContext.md`.

For the current state of the build and the milestone sequence, see the
[roadmap](roadmap.md). For canonical terms, see
[domain-language.md](domain-language.md).

---

## Why this exists

Household chores get forgotten, not refused. The trash goes out on Tuesday and
you remember on Wednesday. The laundry sits wet in the washer. Annual
maintenance slips for a couple of years running. The problem is not a missing
list — it is that a list sits quietly and waits to be looked at.

The differentiating feature is **persistent reminders**: the app keeps nagging
about a chore until it is resolved in the app. Everything else — recurrence,
search, priority, PWA installability — is table stakes around that core.

## Who experiences the strongest need

**Primary: an adult with executive-function slippage who runs a household.** If
you forget to change the laundry or take out the trash on trash day, this app
nags you until it is done.

**Secondary: other adults in that home.** They are lighter users and may never
opt into being nagged at all. The app must be _usable_ by the secondary user and
_indispensable_ to the primary one. Designing for the secondary user's
enthusiasm is the trap.

Children are not users in the MVP. See [Out of scope](#out-of-scope).

## The core job

Two halves:

1. **"Tell me what I need to do next."** The landing view — how the app stays
   usable between nags.
2. **"Don't let me drop it."** The nag — this is the product.

## Product principles

These bound every design decision. They are deliberate, not provisional.

- **Relief is the goal; completion is the instrument.** The app succeeds when
  you stop _carrying_ it — no mental parallel list, no double-checking, trust
  that the app catches what you drop. Track lateness because it is cheap and
  diagnostic, but a version that nags you into 100% completion and leaves you
  anxious has failed at the thing it was built for.
- **The app reports state; it never renders verdicts.** "Trash is two days
  overdue, assigned to Carlos" is a fact. "Carlos is behind" is a judgment. The
  chore is always the subject of the sentence, never the person. This rules out
  streaks, per-person completion counts surfaced as comparison, and any copy
  that makes someone the subject of a sentence about failure.
- **The app does not arbitrate fairness.** It has no notion of balance,
  rotation, effort weighting, or who is pulling their weight. Every household
  solves that differently, or leaves it unsolved; this app will not be the one
  to solve it. Consequently: no effort or duration field, no scorekeeping, no
  leaderboards.
- **The right to interrupt is earned by assignment.** Accepting a chore — by
  being assigned it or claiming it — is what grants the app permission to ring
  your phone. Assigned chores get push. Unassigned work gets ambient pressure
  only.
- **Friendly, positive, mobile-first.** The tone is encouragement, not
  enforcement.

## How the household works

- **The instance is the household.** Self-hosted over SQLite; one deployment
  serves one home. Every user is a member.
- **Permissions are flat** in the MVP — no roles. Assignment is a routing
  concept, not an authority one.
- **Assignment has exactly two paths:** direct assign to a person, or self-claim
  from the pool.
- **The unassigned pool is an inbox, not a home.** It holds up-for-grabs, fuzzy,
  and collaborative work, but items are meant to move out of it.

## The smallest complete experience

> The primary user opens the app. It shows what they are on the hook for today.
> They add "change the laundry," due in an hour. They forget. Their phone
> buzzes. They ignore it. It buzzes again. They change the laundry and mark it
> done. Their partner, elsewhere in the house, opens the app and sees the trash
> is sitting unclaimed — and claims it.

Everything in that paragraph is required for the MVP; nothing outside it is. In
roadmap terms, the MVP is **P0 + P1 + P3** — the app is not the product until
the first nag fires. Milestones are rungs on a ladder, not shippable releases.

## Success evidence

- **The goal: relief.** Has the primary user stopped keeping a parallel list in
  their head? Is "I looked and there's nothing due" a believable state? This is
  qualitative and it is the real measure.
- **The instrument: lateness.** Are chores completed, and completed near when
  they were due? Cheap to capture — logging the due date a completion was
  closing out gives it for free — and it signals when something is off. It is a
  private diagnostic, never a comparison surface.

## Resolved product questions

### How should persistent reminders behave?

Assigned chores get persistent push notifications until resolved — done or
skipped. **Skip must exist**, because a reminder you can only silence by falsely
claiming "done" is a broken reminder. The cadence, escalation ladder, quiet
hours, and delivery-slot policy are recorded in
[ADR 0007](adr/0007-nag-cadence-escalation-and-quiet-hours.md).

Unassigned chores get no push. The pool gets ambient in-app pressure when you
open the app, plus at most one server-configurable blast as a due date nears.
The Pool blast policy is recorded in ADR 0007. The pool's health signal is
**age, not due date** — the fuzzy and collaborative items it is meant to hold
are precisely the ones least likely to carry a due date.

Notification delivery is via Gotify: one server, one account per household
member, each member holding their own application token.

### How do assignment and shared responsibility contribute?

This is a **personal tool that happens to be shared**, not a household
monitoring tool. Your nags are yours. Other members can see the board —
including that an assigned chore is overdue — but that visibility exists so
someone can decide _this needs doing and I should pick it up_, not so anyone can
be evaluated.

**Open, deliberately deferred to real use:** whether overdue assigned work
should actively surface to other members, or only sit visibly on the board. The
neutral-framing principle applies either way, so the decision costs nothing to
defer.

## Identity

**The product is named Tow, with a marine theme.** Settled 2026-08-10; this
replaces the working title "Chores App" everywhere it appears.

The name carries the product. A tugboat pulls something that will not move on
its own, steadily, until it arrives — which is the nag mechanic stated as an
image rather than a feature. Visual specifics (deep teal `#005F6A`, amber accent
`#FFBF00`, tugboat icon) live in [system-design.md](system-design.md).

**The theme lives in the surface, not in the vocabulary.** Name, icon, palette,
illustration, and the tone of copy are themed. The words for the things
themselves stay plain — a chore is a Chore, done is Done, due is Due. Renaming
domain concepts into nautical metaphors ("cargo," "moored," "adrift") would cost
legibility, and legibility is what the [relief goal](#success-evidence) depends
on: a glanceable list you trust is the whole point, and a user who has to
translate the vocabulary is not glancing. Warmth in the copy, plainness in the
nouns.

## Technical direction

- Web application built with Astro, SolidJS islands, UnoCSS, and Deno.
- TypeScript with `deno check` type-checking (conversion in progress; see ADR
  0002).
- Storage: local SQLite via `node:sqlite`. _(Earlier docs specified Knex; the
  code uses raw `node:sqlite` and that is the intended direction.)_
- Auth: Google Sign-In with JWT session cookies.
- Notifications: Gotify.
- Installable as a PWA on mobile, potentially native later.
- Deployment: containerized, deployed to k8s.

## Desired chore capabilities

Status of each is tracked in the [roadmap](roadmap.md); this is the product
wishlist, not a build report.

- Titles, descriptions, due dates, recurrence rules, and priority.
- Fuzzy due windows — an entire week or month, "week 30," "first week in June."
  _(e.g. every June, plan the kids' birthday party; the first week of each
  month, check the budget.)_
- Fuzzy recurrence — "twice a week, any days," "4× a day walk the dogs" — a
  quota over a period rather than specific datetimes.
- Quarterly and other long-period repeats.
- Fast fuzzy search across chores.
- Default view of chores due today; secondary views for all of my chores and for
  the whole household's board, with other members available as an easy filter.
- Sorting by due date and completion state.

## Out of scope

**Out permanently:** fairness arbitration, balance, effort weighting,
scorekeeping, leaderboards.

**Out for v2:** roles and parent→child authority, contested completions
requiring approval, local non-Google accounts for children.

**Undecided:** whether `priority` is surfaced or dropped.
