# Tow Domain Language

This glossary covers Tow, the implemented household chore management product:
authenticated users manage their own chores, optionally schedule chores to
recur, and record completions.

## Language

### Product

**Tow**: The implemented household chore management product. The name belongs to
the product surface. It does not rename chore-management domain concepts.

### Chore Management

**Chore**: A household task owned by a user. A chore has a title, may have a
description, may have a due date, may be recurring, and can be marked done.
_Avoid_: Task, Todo

**Title**: The required short name of a chore.

**Description**: Optional supporting detail for a chore.

**Due Date**: The date/time when a chore is due. For recurring chores, the due
date is calculated from the recurrence rule.

**Done**: The state indicating that a chore has been completed. _Avoid_: Checked
off

**Completion Log**: A record that a chore was marked done at a point in time.

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

**User**: A person who signs in and owns chores.

**Session**: The signed-in state that lets a user access their chores.

**Mock User**: The local development user used when authentication is disabled.
