/** @typedef {import('astro').APIRoute} APIRoute */
/** @typedef {import('../../../utils/auth.js').UserPayload} UserPayload */
import db from "../../../utils/db.js";
import { calculateNextOccurrence } from "../../../utils/scheduleUtils.js";

/** @type {APIRoute} */
export const GET = ({ locals }) => {
  /** @type {UserPayload | null} */
  const user = /** @type {any} */ (locals).user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const stmt = db.prepare(
      `SELECT * FROM chores WHERE user_id = ? ORDER BY due_date`,
    );
    /** @type {any[]} */
    const chores = stmt.all(user.id);

    // Parse JSON columns if needed, SQLite returns them as strings usually if inserted as strings
    const parsedChores = chores.map((chore) => {
      try {
        if (chore && typeof chore.recurrence === "string") {
          chore.recurrence = JSON.parse(chore.recurrence);
        }
      } catch (_e) {
        // ignore
      }
      return chore;
    });

    return new Response(JSON.stringify(parsedChores), {
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

/**
 * @param {import('astro').APIContext} context
 */
export const POST = async ({ request, locals, redirect }) => {
  /** @type {UserPayload | null} */
  const user = /** @type {any} */ (locals).user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let data;
    let isForm = false;

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      data = Object.fromEntries(formData.entries());
      isForm = true;
    } else {
      data = await request.json();
    }

    const { title, description, rrule } = data;

    if (!title) {
      if (isForm) return redirect("/?error=Title+is+required", 302);
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
      });
    }

    const id = crypto.randomUUID();
    let nextDueDate = null;

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
    const newChore = getStmt.get(id);

    try {
      if (newChore && typeof newChore.recurrence === "string") {
        newChore.recurrence = JSON.parse(newChore.recurrence);
      }
    } catch (_e) {
      // ignore
    }

    return new Response(JSON.stringify(newChore), {
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
