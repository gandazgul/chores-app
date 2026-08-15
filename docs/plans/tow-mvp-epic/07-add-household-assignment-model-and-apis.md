---

planId: "9423fd18-e4b9-4c41-988a-b750e9a2eb02" classification: "PLANNED_CHANGE"
workKind: "FEATURE" complexity: "MEDIUM" summary: "Add creator versus assignee
fields, unassigned pool state, flat household permissions, and first-class
claim, assign, release, and reassign mutations. Add the member read endpoint and
domain language for household terms." affectedPaths:

- "src/**/migrations/**"
- "src/pages/api/chores/**"
- "src/pages/api/members/**"
- "src/pages/index.astro"
- "src/utils/**"
- "tests/**"
- "docs/domain-language.md" objectiveCheckWaivers: [] executionAgent: "engineer"
  collaborationRecommendation: "autonomous" createdAt:
  "2026-08-10T16:07:51.880Z" updatedAt: "2026-08-15T17:57:32.195Z" status:
  "verified" origin: "internal" parentPlan: "tow-mvp-epic" order: 7
  dependencies:
- "05-provision-household-users-behind-an-allowlist"
- "06-restore-csrf-protection-for-browser-mutations" implementedAt:
  "2026-08-15T15:37:33.377Z" verifiedAt: "2026-08-15T17:57:32.195Z"
  userVerifiedAt: null ... more files changed
