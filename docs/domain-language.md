# Tow Domain Language

This glossary covers Tow, the implemented household chore management product:
authenticated household members manage shared chores, optionally schedule chores
to recur, and record completions.

## Language

### Product

**Tow**: The implemented household chore management product. The name belongs to
the product surface. It does not rename chore-management domain concepts.

### Chore Management

**Chore**: A household task in the shared household list. A chore has a Creator,
may have an Assignee, may be in the Pool, has a title, may have a description,
may have a due date, may be recurring, and can be marked done. _Avoid_: Task,
Todo

**Title**: The required short name of a chore.

**Description**: Optional supporting detail for a chore.

**Due Date**: The date/time when a chore is due. For recurring chores, the due
date is calculated from the recurrence rule.

**Done**: The state indicating that a chore has been completed. _Avoid_: Checked
off

**Completion Log**: A record that a chore was marked done at a point in time.

### Assignment

**Creator**: The Member who created a chore. Creator is historical identity. It
is not permission or assignment. _Avoid_: Owner

**Assignee**: The Member currently on the hook for a chore. Assignment permits
future reminder push behavior; it does not grant special edit, delete, or done
rights. _Avoid_: Owner

**Pool**: The unassigned inbox for chores that are up for grabs. A Pool chore
has no Assignee and records when it entered the Pool. The Pool creates ambient
in-app pressure only.

**Claim**: A Member moves a Pool chore to themself.

**Assign**: A Member moves a Pool chore to a selected Member.

**Release**: A Member moves an assigned chore back to the Pool. Release starts a
new Pool-entry time.

**Reassign**: A Member moves an assigned chore from its current Assignee to a
different Member.

### Recurrence

**Recurrence**: A schedule attached to a chore that causes future occurrences to
be created after completion.

**Recurring Chore**: A chore with recurrence. When marked done, the current
chore is completed and a new chore is created for the next occurrence.

**RRULE**: The recurrence-rule string format used to describe recurrence, such
as daily, weekly, or monthly schedules.

**Next Occurrence**: The next due date calculated from an RRULE after a starting
date.

### People and Access

**Member**: A person who can sign in to this Tow household. In the MVP,
permissions are flat: each Member can see and mutate all household chores.

**User**: The authenticated account record for a Member. Use Member in product
language when the person belongs to the household.

**Session**: The signed-in state that lets a Member access household chores.

**Mock User**: The local development User used when authentication is disabled.
