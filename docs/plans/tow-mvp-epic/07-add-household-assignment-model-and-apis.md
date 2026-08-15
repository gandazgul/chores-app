---
planId: "9423fd18-e4b9-4c41-988a-b750e9a2eb02"
classification: "PLANNED_CHANGE"
workKind: "FEATURE"
complexity: "MEDIUM"
summary: "Add creator versus assignee fields, Pool state, flat household permissions, strict claim/assign/release/reassign APIs, and a safe household member endpoint."
affectedPaths:
  - "src/db/migrations/**"
  - "src/domain/**"
  - "src/pages/api/auth/login.*"
  - "src/pages/api/chores/**"
  - "src/pages/api/members/**"
  - "src/pages/index.astro"
  - "src/types.ts"
  - "scripts/setup_db.js"
  - "tests/**"
  - "docs/domain-language.md"
objectiveChecks:
  - id: "OC1"
    command: "deno eval 'Deno.env.set(\"DB_ENV\",\"test\");const d=(await import(\"./src/utils/db.ts\")).default,{transitionAssignment:t}=await import(\"./src/domain/choreAssignment.ts\"),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();try{const u=d.prepare(\"INSERT INTO users(id,email)VALUES(?,?)\");u.run(a,a+\"@x\");u.run(b,b+\"@x\");d.prepare(\"INSERT INTO chores(id,user_id,title,assignee_id)VALUES(?,?,?,?)\").run(c,a,\"x\",a);let r=t(d,c,a,{action:\"release\"});if(r.kind!==\"updated\"||r.chore.assignee_id!==null||!r.chore.unassigned_since||r.chore.revision!==1)throw Error(\"release\");r=t(d,c,b,{action:\"claim\"});if(r.kind!==\"updated\"||r.chore.assignee_id!==b||r.chore.unassigned_since!==null||r.chore.revision!==2)throw Error(\"claim\")}finally{d.prepare(\"DELETE FROM chores WHERE id=?\").run(c);d.prepare(\"DELETE FROM users WHERE id IN (?,?)\").run(a,b)}'"
    rationale: "This fails on the current tree because the assignment module and schema do not exist. It passes only when real release and claim transitions update Pool state, Assignee state, and revision through the planned domain interface."
objectiveChecksBaseline:
  recordedAt: "2026-08-15T15:27:54.365Z"
  head: "21fc3dbd322ea8402e5979ef2b0f4c6030ddb6f6"
  results:
    - id: "OC1"
      command: "deno eval 'Deno.env.set(\"DB_ENV\",\"test\");const d=(await import(\"./src/utils/db.ts\")).default,{transitionAssignment:t}=await import(\"./src/domain/choreAssignment.ts\"),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();try{const u=d.prepare(\"INSERT INTO users(id,email)VALUES(?,?)\");u.run(a,a+\"@x\");u.run(b,b+\"@x\");d.prepare(\"INSERT INTO chores(id,user_id,title,assignee_id)VALUES(?,?,?,?)\").run(c,a,\"x\",a);let r=t(d,c,a,{action:\"release\"});if(r.kind!==\"updated\"||r.chore.assignee_id!==null||!r.chore.unassigned_since||r.chore.revision!==1)throw Error(\"release\");r=t(d,c,b,{action:\"claim\"});if(r.kind!==\"updated\"||r.chore.assignee_id!==b||r.chore.unassigned_since!==null||r.chore.revision!==2)throw Error(\"claim\")}finally{d.prepare(\"DELETE FROM chores WHERE id=?\").run(c);d.prepare(\"DELETE FROM users WHERE id IN (?,?)\").run(a,b)}'"
      rationale: "This fails on the current tree because the assignment module and schema do not exist. It passes only when real release and claim transitions update Pool state, Assignee state, and revision through the planned domain interface."
      status: "unmet"
      stdout: ""
      stderr: "\u001b[0m\u001b[1m\u001b[31merror\u001b[0m: Uncaught (in promise) TypeError: Module not found \"file:///Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64/src/domain/choreAssignment.ts\".\n    at async \u001b[0m\u001b[2m\u001b[38;5;245mfile:///Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64/\u001b[0m\u001b[0m\u001b[36m$deno$eval.mts\u001b[0m:\u001b[0m\u001b[33m1\u001b[0m:\u001b[0m\u001b[33m108\u001b[0m\n"
      exitCode: 1
      durationMs: 36
      output: "\n\u001b[0m\u001b[1m\u001b[31merror\u001b[0m: Uncaught (in promise) TypeError: Module not found \"file:///Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64/src/domain/choreAssignment.ts\".\n    at async \u001b[0m\u001b[2m\u001b[38;5;245mfile:///Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64/\u001b[0m\u001b[0m\u001b[36m$deno$eval.mts\u001b[0m:\u001b[0m\u001b[33m1\u001b[0m:\u001b[0m\u001b[33m108\u001b[0m\n"
executionAgent: "engineer"
collaborationRecommendation: "autonomous"
createdAt: "2026-08-10T16:07:51.880Z"
updatedAt: "2026-08-15T15:27:54.525Z"
status: "in_progress"
origin: "internal"
parentPlan: "tow-mvp-epic"
order: 7
dependencies:
  - "05-provision-household-users-behind-an-allowlist"
  - "06-restore-csrf-protection-for-browser-mutations"
userVerifiedAt: null
humanReviewMode: null
humanReviewDecision: null
validationCheckpoint: null
executionMode: "worktree"
executionBaselineTree: "abd820aae8798f170faab3fc21acbedf9c4b28e0"
worktreeId: "1de7ad64"
worktreePath: "/Users/gandazgul/.wld/worktrees/--Users-gandazgul-Documents-web-chores-app--/chores-app-tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64"
worktreeBranch: "worktree/tow-mvp-epic-07-add-household-assignment-model-a-1de7ad64"
worktreeBaseBranch: "main"
worktreeStatus: "active"
---

# Add Household Assignment Model and APIs

## Context

Tow currently exposes one private chore list per signed-in User. Both the page
and `GET /api/chores` filter on `chores.user_id`, while update and delete return
403 for a different User. The household model instead treats one deployment as
one household: every Member can see and mutate every chore, and assignment
routes work without granting authority.

Dependencies 05 and 06 are complete. Successful Google login now provisions a
User, and browser mutations have a strict same-origin boundary. Google profile
pictures are still Session-only, so they must be persisted before a household
member list can return a stable assignment-picker record.

## Objective

Establish the household data and application programming interface (API)
contract used by later user-interface and notification children. Keep
`chores.user_id` as immutable Creator identity, add nullable Assignee identity
and Pool-entry time, remove owner-scoped access, and expose strict claim,
assign, release, and reassign transitions. Add an authenticated member read
endpoint with safe public fields and update the domain glossary with the model
that is now implemented.

## Approach

Migration `0004_household_assignment` adds nullable `users.picture`, nullable
`chores.assignee_id REFERENCES users(id)`, and nullable
`chores.unassigned_since`. This is a greenfield target: do not backfill or add a
compatibility path for chore rows created before migration 0004. Freshly created
and seeded rows must satisfy the final invariant:

```text
Assigned: assignee_id = Member id, unassigned_since = NULL
Pool:     assignee_id = NULL,      unassigned_since = entry timestamp
```

Successful Google login stores the latest nullable picture URL.
`GET
/api/members` returns only `{ id, name, picture }`, in deterministic
name/id order, to an authenticated Member. It does not return email, timestamps,
Session data, or future notification credentials.

`src/domain/choreAssignment.ts` exports
`transitionAssignment(db, choreId, actorId, command, { now? })` and owns each
assignment transition in one `BEGIN IMMEDIATE` transaction. Its result union
returns `{ kind: "updated", chore }` on success and distinguishes missing chore,
missing Member, and conflict outcomes so the route contains no assignment SQL.
`POST /api/chores/:id/assignment` accepts:

```json
{ "action": "claim" | "assign" | "release" | "reassign", "assigneeId": "member-id" }
```

`assigneeId` is required only for assign and reassign. Claim always selects the
signed-in Member. The source states are strict: claim and assign start in Pool;
release and reassign start assigned. A resolved chore, a wrong source state, or
reassignment to the current Assignee returns 409 without writes. A missing chore
or target Member returns 404; malformed action/payload returns 400. Successful
transitions update both assignment fields, increment `revision`, and update
`updated_at` atomically.

Create accepts `assigneeId?: string | null`: omission defaults to the Creator,
`null` selects Pool, and a Member id directly assigns. Native form input uses an
empty `assigneeId` value for Pool and omission for the Creator default. General
chore `PUT` does not become an assignment setter.

Recurring resolution keeps its existing transaction and behavior, but a new
occurrence inherits the prior Assignee. A successor created from Pool receives a
new `unassigned_since` timestamp so Pool age belongs to the new occurrence.

The rejected alternative was overloading general `PUT` with `assigneeId`; it is
smaller, but it erases the product distinction between self-claim and direct
assignment.

## Files to Modify

- `src/db/migrations/0004_household_assignment.ts` — add the nullable picture,
  Assignee, and Pool-entry columns and validate their types and foreign key.
- `src/db/migrations/index.ts` and `src/db/migrations/index.test.ts` — register
  migration 0004 and prove the final fresh-database schema and ledger.
- `src/types.ts` — add assignment fields to `ChoreRow`/`Chore` and define the
  safe `Member` response shape.
- `src/pages/api/auth/login.ts` and `src/pages/api/auth/login.test.ts` — persist
  and refresh nullable Google picture URLs during allowed login.
- `src/domain/choreAssignment.ts` and its tests — own strict, transactional
  assignment state transitions and error results.
- `src/domain/occurrenceResolution.ts` and its tests — carry assignment to a
  recurring successor and start a new Pool timestamp for a Pool successor.
- `src/pages/api/chores/index.ts` — list all open household chores; accept the
  create assignment contract; validate a requested Member; set Creator,
  Assignee, and Pool-entry state.
- `src/pages/api/chores/[id].ts` — remove Creator-only update/delete checks
  while preserving authentication, 404, conflict, completion, and delete
  behavior.
- `src/pages/api/chores/[id]/assignment.ts` — expose the strict assignment
  action contract and map domain results to 200/400/404/409 responses.
- `src/pages/api/chores/chores.test.ts` and assignment route/domain tests —
  cover household visibility, flat mutations, create choices, transitions,
  timestamps, revision changes, and recurrence inheritance.
- `src/pages/api/members/index.ts` and `index.test.ts` — expose and verify the
  authenticated safe member list.
- `src/pages/index.astro` — query all open household chores without a Creator
  filter until child 09 replaces this list with the three household views.
- `scripts/setup_db.js` — seed a named Member and chores that satisfy the final
  assigned-state shape; do not create Pool rows without `unassigned_since`.
- `docs/domain-language.md` — replace private ownership language and define
  Member, Creator, Assignee, Pool, Claim, Assign, Release, and Reassign.

## Reuse Opportunities

Existing functions, modules, or patterns to reuse:

- `src/db/migrations/index.ts` and `0003_user_names.ts` — use the static,
  forward-only migration registry and schema validation style.
- `src/domain/occurrenceResolution.ts` — follow its transaction/result-union
  pattern; extend successor creation instead of adding a second recurrence path.
- `src/pages/api/chores/index.ts` — preserve form-versus-JSON content
  negotiation and its 302/JSON response behavior.
- `src/pages/api/chores/[id].ts` — preserve authentication, error response, and
  parsed `Chore` response conventions.
- `src/middleware.ts` — rely on the established authenticated `locals.user` and
  same-origin mutation boundary; do not add a second cross-site request forgery
  mechanism.

## Implementation Steps

- [ ] Registered migration 0004 gives fresh databases nullable `users.picture`,
      nullable `chores.assignee_id` with a `users(id)` foreign key, and nullable
      `chores.unassigned_since`; it contains no legacy chore backfill.
- [ ] Allowed login inserts and refreshes `users.picture` together with email
      and name, including clearing a previously stored picture when the provider
      payload has no picture.
- [ ] `ChoreRow` and parsed API responses expose `assignee_id` and
      `unassigned_since`, while `user_id` remains Creator identity.
- [ ] New JSON and form chores default to the Creator as Assignee; explicit Pool
      input writes a current `unassigned_since`; explicit Member input is
      rejected when that Member does not exist.
- [ ] `GET /api/chores` and `src/pages/index.astro` return all open household
      chores without a `user_id` predicate for every authenticated Member.
- [ ] Any authenticated Member can edit, complete, reopen, and delete a chore
      created by another Member; unauthenticated requests and existing
      completion-conflict semantics remain protected.
- [ ] `src/domain/choreAssignment.ts` atomically implements Pool-to-self claim,
      Pool-to-Member assign, assigned-to-Pool release, and
      assigned-to-different- Member reassign with assignment-field invariants
      and one revision increment per success.
- [ ] `POST /api/chores/:id/assignment` enforces strict source states and maps
      malformed input, missing resources, and state conflicts to the specified
      400/404/409 responses without partial writes.
- [ ] Recurring completion creates a successor with the same Assignee, or with a
      fresh Pool-entry timestamp when the parent occurrence is in Pool;
      completion/un-completion idempotency and one-open-occurrence behavior stay
      intact.
- [ ] Authenticated `GET /api/members` returns every provisioned household
      Member as only `id`, nullable `name`, and nullable `picture`, in stable
      order; unauthenticated access returns 401.
- [ ] `scripts/setup_db.js` produces only assignment-consistent seed chores in a
      fresh database.
- [ ] `docs/domain-language.md` describes shared Chores and defines Member,
      Creator, Assignee, Pool, Claim, Assign, Release, and Reassign; it marks
      Owner as an avoided alias for Creator or Assignee.

## Approval Confirmation

No Work Records are proposed for supersession.

## Verification Plan

- Automated: `deno task ci`.
- Automated:
  `deno test -A src/db/migrations/index.test.ts
  src/pages/api/auth/login.test.ts src/domain/occurrenceResolution.test.ts`.
- Automated: household API tests create two Members and prove both receive the
  same open chore list; the non-Creator can edit, complete/reopen, and delete.
- Automated: assignment tests exercise all four successful transitions and
  assert exact `assignee_id`, `unassigned_since`, `revision`, and `updated_at`
  outcomes. They also prove wrong source states, resolved chores, the current
  Assignee as a reassign target, nonexistent Members, and malformed payloads do
  not write.
- Automated: create tests cover omitted, null/empty, valid-Member, and unknown-
  Member `assigneeId` for JSON and form parsing without losing current redirects
  or JSON responses.
- Automated: recurrence tests prove assigned and Pool successors inherit the
  correct assignment state while transactional complete/un-complete behavior
  remains protected.
- Automated: member endpoint tests prove 401 without a Session, stable public
  records with pictures when present, and absence of `email`, timestamps,
  Session fields, and unknown/future secret columns.
- Expected to remain: Google identity-token login and 30-day Session creation,
  same-origin mutation rejection, form/JSON content negotiation, transactional
  reversible completion, and `status = 'open'` as active-state authority.
- Expected to stop: private `WHERE user_id = ?` list queries and Creator-only
  403 responses. No role or per-Owner authority replaces them.
- Glossary check: implemented code, response names, tests, and
  `docs/domain-language.md` use Creator, Assignee, Pool, and Member consistently
  and do not describe a Chore as owned by one User.

## Edge Cases & Considerations

- Flat permissions are intentional. Assignment routes work; they do not grant
  edit, delete, or completion authority.
- The Pool is an inbox. This child records Pool age but adds no push, age badge,
  fairness rule, or assignment UI.
- All assignment transitions are limited to `status = 'open'`. Resolved rows
  retain their final assignment as history.
- Release always sets a fresh Pool timestamp. Claim, assign, and reassign always
  clear it. A new Pool recurrence occurrence gets a fresh timestamp rather than
  inheriting the prior occurrence's age.
- Member lookup uses the provisioned `users` table as the household source of
  truth. Do not accept arbitrary IDs and rely only on the foreign-key error.
- Picture is public profile metadata, nullable, and provider-controlled. Return
  it as data only; do not fetch, proxy, or validate the remote image in this
  child.
- The user explicitly selected a greenfield result. Migration 0004 does not
  preserve or normalize chores created under schema versions 1–3; only fresh and
  newly created/seeded data must satisfy assignment invariants.
