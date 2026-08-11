import type { APIRoute } from "astro";
import type { ChoreRow } from "../../../types.ts";
import { parseChoreRow, parseChoreRows } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { calculateNextOccurrence } from "../../../utils/scheduleUtils.ts";

interface ChoreCreateInput {
  title?: string;
  description?: string;
  rrule?: string;
}

function readStringField(
  input: Record<string, FormDataEntryValue | unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

async function readCreateInput(
  request: Request,
): Promise<{ data: ChoreCreateInput; isForm: boolean }> {
  const contentType = request.headers.get("content-type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    const entries = Object.fromEntries(formData.entries());
    return {
      data: {
        title: readStringField(entries, "title"),
        description: readStringField(entries, "description"),
        rrule: readStringField(entries, "rrule"),
      },
      isForm: true,
    };
  }

  const body: unknown = await request.json();
  const record = typeof body === "object" && body !== null
    ? body as Record<string, unknown>
    : {};
  return {
    data: {
      title: readStringField(record, "title"),
      description: readStringField(record, "description"),
      rrule: readStringField(record, "rrule"),
    },
    isForm: false,
  };
}

export const GET: APIRoute = ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const stmt = db.prepare(
      `SELECT * FROM chores WHERE user_id = ? ORDER BY due_date`,
    );
    const chores = stmt.all(user.id) as unknown as ChoreRow[];

    return new Response(JSON.stringify(parseChoreRows(chores)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch chores:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const { data, isForm } = await readCreateInput(request);
    const { title, description, rrule } = data;

    if (!title) {
      if (isForm) return redirect("/?error=Title+is+required", 302);
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
      });
    }

    const id = crypto.randomUUID();
    let nextDueDate: Date | null = null;

    if (rrule) {
      nextDueDate = calculateNextOccurrence(rrule);
      if (!nextDueDate) {
        if (isForm) return redirect("/?error=Invalid+RRULE", 302);
        return new Response(JSON.stringify({ error: "Invalid RRULE" }), {
          status: 400,
        });
      }
    }

    const recurrenceJson = rrule ? JSON.stringify({ rrule }) : null;
    const dueDateStr = nextDueDate ? nextDueDate.toISOString() : null;

    const stmt = db.prepare(`
      INSERT INTO chores (id, user_id, title, description, due_date, recurrence, done)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `);

    stmt.run(
      id,
      user.id,
      title,
      description || null,
      dueDateStr,
      recurrenceJson,
    );

    if (isForm) {
      return redirect("/", 302);
    }

    const getStmt = db.prepare(`SELECT * FROM chores WHERE id = ?`);
    const newChore = getStmt.get(id) as unknown as ChoreRow | undefined;

    return new Response(JSON.stringify(newChore && parseChoreRow(newChore)), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to create chore:", error);
    if (request.headers.get("content-type")?.includes("form")) {
      return redirect("/?error=Internal+Server+Error", 302);
    }
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};
