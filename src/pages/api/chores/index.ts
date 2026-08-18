import type { APIRoute } from "astro";
import type { ChoreRow, UserPayload } from "../../../types.ts";
import { parseChoreRow, parseChoreRows } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { calculateNextOccurrence } from "../../../utils/scheduleUtils.ts";

interface ChoreCreateInput {
  title?: string;
  description?: string;
  rrule?: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  remindUntilDone?: boolean | null;
}

function readStringField(
  input: Record<string, FormDataEntryValue | unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
}

function readJsonNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readFormNullableString(
  entries: Record<string, FormDataEntryValue>,
  key: string,
): string | null | undefined {
  if (!(key in entries)) return undefined;
  const value = entries[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readJsonBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  if (!(key in record)) return undefined;
  return typeof record[key] === "boolean" ? record[key] : null;
}

function readFormBoolean(
  entries: Record<string, FormDataEntryValue>,
  key: string,
): boolean | undefined {
  if (!(key in entries)) return undefined;
  return entries[key] === "on" || entries[key] === "true";
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
        dueDate: readFormNullableString(entries, "dueDate"),
        assigneeId: readFormNullableString(entries, "assigneeId"),
        remindUntilDone: readFormBoolean(entries, "remindUntilDone"),
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
      dueDate: readJsonNullableString(record, "dueDate"),
      assigneeId: readJsonNullableString(record, "assigneeId"),
      remindUntilDone: readJsonBoolean(record, "remindUntilDone"),
    },
    isForm: false,
  };
}

function ensureUser(user: UserPayload) {
  db.prepare(`
    INSERT INTO users (id, email, name, picture)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      updated_at = CURRENT_TIMESTAMP
  `).run(user.id, user.email, user.name, user.picture ?? null);
}

function memberExists(memberId: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE id = ?").get(memberId));
}

function validIsoDate(value: string | null): boolean {
  return value === null || !Number.isNaN(new Date(value).getTime());
}

function errorResponse(isForm: boolean, error: string, status: number) {
  if (isForm) {
    return new Response(null, {
      status: 302,
      headers: { location: `/?error=${encodeURIComponent(error)}` },
    });
  }
  return new Response(JSON.stringify({ error }), { status });
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
      `SELECT * FROM chores WHERE status IN ('open', 'completed') ORDER BY due_date`,
    );
    const chores = stmt.all() as unknown as ChoreRow[];

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

    if (!title || !title.trim()) {
      if (isForm) return redirect("/?error=Title+is+required", 302);
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
      });
    }

    if (data.dueDate !== undefined && !validIsoDate(data.dueDate)) {
      return errorResponse(isForm, "Invalid dueDate", 400);
    }
    if (data.remindUntilDone === null) {
      return errorResponse(isForm, "remindUntilDone must be boolean", 400);
    }

    const id = crypto.randomUUID();
    let nextDueDate: Date | null = null;

    if (rrule && data.dueDate === undefined) {
      nextDueDate = calculateNextOccurrence(rrule);
      if (!nextDueDate) {
        if (isForm) return redirect("/?error=Invalid+RRULE", 302);
        return new Response(JSON.stringify({ error: "Invalid RRULE" }), {
          status: 400,
        });
      }
    }

    ensureUser(user);

    const assigneeId = data.assigneeId === undefined
      ? user.id
      : data.assigneeId;
    if (assigneeId !== null && !memberExists(assigneeId)) {
      if (isForm) return redirect("/?error=Member+not+found", 302);
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
      });
    }

    const recurrenceJson = rrule ? JSON.stringify({ rrule }) : null;
    const dueDateStr = data.dueDate !== undefined
      ? data.dueDate
      : nextDueDate
      ? nextDueDate.toISOString()
      : null;
    const now = new Date();
    const remindUntilDone = data.remindUntilDone === undefined
      ? 1
      : data.remindUntilDone
      ? 1
      : 0;
    const unassignedSince = assigneeId === null ? now.toISOString() : null;
    const nagEligibleSince = assigneeId !== null && dueDateStr !== null &&
        remindUntilDone === 1
      ? now.toISOString()
      : null;

    const stmt = db.prepare(`
      INSERT INTO chores (
        id,
        user_id,
        assignee_id,
        unassigned_since,
        title,
        description,
        due_date,
        recurrence,
        remind_until_done,
        nag_eligible_since,
        done
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    stmt.run(
      id,
      user.id,
      assigneeId,
      unassignedSince,
      title.trim(),
      description || null,
      dueDateStr,
      recurrenceJson,
      remindUntilDone,
      nagEligibleSince,
    );

    if (isForm) return redirect("/", 302);

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
