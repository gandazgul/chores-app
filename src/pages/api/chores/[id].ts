import type { APIRoute } from "astro";
import { updateOccurrence } from "../../../domain/occurrenceResolution.ts";
import type { ChoreRow } from "../../../types.ts";
import { parseChoreRow } from "../../../types.ts";
import db from "../../../utils/db.ts";

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

    const data = readUpdateInput(await request.json());
    const result = updateOccurrence(db, id, data);

    if (result.kind === "not_found") {
      return new Response(JSON.stringify({ error: "Chore not found" }), {
        status: 404,
      });
    }
    if (result.kind === "conflict") {
      return new Response(JSON.stringify({ error: result.reason }), {
        status: 409,
      });
    }

    return new Response(JSON.stringify(parseChoreRow(result.chore)), {
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
