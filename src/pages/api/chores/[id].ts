import type { APIRoute } from "astro";
import {
  type OccurrenceResolution,
  updateOccurrence,
} from "../../../domain/occurrenceResolution.ts";
import type { ChoreRow } from "../../../types.ts";
import { parseChoreRow } from "../../../types.ts";
import db from "../../../utils/db.ts";

interface ChoreUpdateInput {
  title?: string;
  description?: string | null;
  rrule?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  done?: boolean;
  resolution?: OccurrenceResolution;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  return typeof value === "string" ? value : null;
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
  input.rrule = readNullableString(record, "rrule");
  input.dueDate = readNullableString(record, "dueDate");
  input.assigneeId = readNullableString(record, "assigneeId");
  if ("done" in record && typeof record.done === "boolean") {
    input.done = record.done;
  }
  if (
    "resolution" in record &&
    (record.resolution === "completed" || record.resolution === "skipped")
  ) {
    input.resolution = record.resolution;
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
    if (result.kind === "member_not_found") {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
      });
    }
    if (result.kind === "invalid") {
      return new Response(JSON.stringify({ error: result.reason }), {
        status: 400,
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
