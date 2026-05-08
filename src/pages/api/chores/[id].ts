import type { APIRoute } from "astro";
import type { UserPayload } from "../../../utils/auth.ts";
import db from "../../../utils/db.js";
import { calculateNextOccurrence } from "../../../utils/scheduleUtils.ts";

export const PUT: APIRoute = async ({ params, request, locals }) => {
  // deno-lint-ignore no-explicit-any
  const user = (locals as any).user as UserPayload | null;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Chore ID is required" }), {
      status: 400,
    });
  }

  try {
    const existingStmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    // deno-lint-ignore no-explicit-any
    const existingChore = existingStmt.get(id) as any;

    if (!existingChore) {
      return new Response(JSON.stringify({ error: "Chore not found" }), {
        status: 404,
      });
    }

    if (existingChore.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    const data = await request.json();
    const { title, description, rrule, done } = data;

    let dueDateStr = existingChore.due_date;
    let recurrenceJson = existingChore.recurrence;
    let isDone = existingChore.done;

    if (title !== undefined) existingChore.title = title;
    if (description !== undefined) existingChore.description = description;

    if (rrule !== undefined) {
      recurrenceJson = rrule ? JSON.stringify({ rrule }) : null;
      if (rrule) {
        const nextDueDate = calculateNextOccurrence(rrule);
        dueDateStr = nextDueDate ? nextDueDate.toISOString() : null;
      } else {
        dueDateStr = null;
      }
    }

    if (done !== undefined) {
      isDone = done;
      if (done) {
        // Chore marked as completed
        let parsedRecurrence = null;
        try {
          if (typeof recurrenceJson === "string") {
            parsedRecurrence = JSON.parse(recurrenceJson);
          } else {
            parsedRecurrence = recurrenceJson;
          }
        } catch (_e) {
          // ignore
        }

        if (parsedRecurrence && parsedRecurrence.rrule) {
          // Calculate next due date
          const nextDueDate = calculateNextOccurrence(
            parsedRecurrence.rrule,
            new Date(),
          );
          if (nextDueDate) {
            dueDateStr = nextDueDate.toISOString();
            // It resets to not done for the next occurrence
            isDone = false;
          }
        }

        // Create completion log
        const logId = crypto.randomUUID();
        db.prepare(`INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)`)
          .run(logId, id);
      }
    }

    const updateStmt = db.prepare(`
      UPDATE chores 
      SET title = ?, description = ?, due_date = ?, recurrence = ?, done = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      existingChore.title,
      existingChore.description,
      dueDateStr,
      recurrenceJson,
      isDone ? 1 : 0,
      id,
    );

    const getStmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    // deno-lint-ignore no-explicit-any
    const updatedChore = getStmt.get(id) as any;

    try {
      if (updatedChore && typeof updatedChore.recurrence === "string") {
        updatedChore.recurrence = JSON.parse(updatedChore.recurrence);
      }
    } catch (_e) {
      // ignore
    }

    return new Response(JSON.stringify(updatedChore), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to update chore:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};

export const DELETE: APIRoute = ({ params, locals }) => {
  // deno-lint-ignore no-explicit-any
  const user = (locals as any).user as UserPayload | null;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: "Chore ID is required" }), {
      status: 400,
    });
  }

  try {
    const existingStmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    // deno-lint-ignore no-explicit-any
    const existingChore = existingStmt.get(id) as any;

    if (!existingChore) {
      return new Response(JSON.stringify({ error: "Chore not found" }), {
        status: 404,
      });
    }

    if (existingChore.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      });
    }

    const deleteStmt = db.prepare(`DELETE FROM chores WHERE id = ?`);
    deleteStmt.run(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete chore:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};
