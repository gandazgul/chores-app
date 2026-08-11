import type { APIRoute } from "astro";
import type { ChoreRow, Recurrence } from "../../../types.ts";
import { parseChoreRow, parseRecurrence } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { calculateNextOccurrence } from "../../../utils/scheduleUtils.ts";

interface ChoreUpdateInput {
  title?: string;
  description?: string | null;
  rrule?: string | null;
  done?: boolean;
}

function readUpdateInput(body: unknown): ChoreUpdateInput {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const record = body as Record<string, unknown>;
  const input: ChoreUpdateInput = {};

  if ("title" in record && typeof record.title === "string") {
    input.title = record.title;
  }
  if ("description" in record) {
    input.description = typeof record.description === "string"
      ? record.description
      : null;
  }
  if ("rrule" in record) {
    input.rrule = typeof record.rrule === "string" ? record.rrule : null;
  }
  if ("done" in record && typeof record.done === "boolean") {
    input.done = record.done;
  }

  return input;
}

function hasRRule(
  recurrence: Recurrence | string | null,
): recurrence is Recurrence {
  return typeof recurrence === "object" && recurrence !== null &&
    typeof recurrence.rrule === "string";
}

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
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
    const existingChore = existingStmt.get(id) as unknown as
      | ChoreRow
      | undefined;

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

    const data = readUpdateInput(await request.json());

    let title = existingChore.title;
    let description = existingChore.description;
    let dueDateStr = existingChore.due_date;
    let recurrenceJson = existingChore.recurrence;
    let isDone: boolean | number = existingChore.done;

    if (data.title !== undefined) title = data.title;
    if (data.description !== undefined) description = data.description;

    if (data.rrule !== undefined) {
      recurrenceJson = data.rrule
        ? JSON.stringify({ rrule: data.rrule })
        : null;
      if (data.rrule) {
        const nextDueDate = calculateNextOccurrence(data.rrule);
        dueDateStr = nextDueDate ? nextDueDate.toISOString() : null;
      } else {
        dueDateStr = null;
      }
    }

    if (data.done !== undefined) {
      isDone = data.done;
      if (data.done) {
        const parsedRecurrence = parseRecurrence(recurrenceJson);

        if (hasRRule(parsedRecurrence)) {
          const nextDueDate = calculateNextOccurrence(
            parsedRecurrence.rrule,
            new Date(),
          );
          if (nextDueDate) {
            const newChoreId = crypto.randomUUID();
            db.prepare(`
              INSERT INTO chores (id, user_id, title, description, due_date, recurrence, done)
              VALUES (?, ?, ?, ?, ?, ?, 0)
            `).run(
              newChoreId,
              existingChore.user_id,
              title,
              description,
              nextDueDate.toISOString(),
              recurrenceJson,
            );

            recurrenceJson = null;
            isDone = 1;
            dueDateStr = existingChore.due_date;
          }
        }

        const logId = crypto.randomUUID();
        db.prepare(`INSERT INTO completion_logs (id, chore_id) VALUES (?, ?)`)
          .run(
            logId,
            id,
          );
      }
    }

    const updateStmt = db.prepare(`
      UPDATE chores 
      SET title = ?, description = ?, due_date = ?, recurrence = ?, done = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(
      title,
      description,
      dueDateStr,
      recurrenceJson,
      isDone ? 1 : 0,
      id,
    );

    const getStmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    const updatedChore = getStmt.get(id) as unknown as ChoreRow | undefined;

    return new Response(
      JSON.stringify(updatedChore && parseChoreRow(updatedChore)),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Failed to update chore:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};

export const DELETE: APIRoute = ({ params, locals }) => {
  const user = locals.user;
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
    const existingChore = existingStmt.get(id) as unknown as
      | ChoreRow
      | undefined;

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
