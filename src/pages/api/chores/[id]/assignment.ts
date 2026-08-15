import type { APIRoute } from "astro";
import {
  type AssignmentCommand,
  transitionAssignment,
} from "../../../../domain/choreAssignment.ts";
import { parseChoreRow } from "../../../../types.ts";
import db from "../../../../utils/db.ts";

function readCommand(body: unknown): AssignmentCommand | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const record = body as Record<string, unknown>;
  if (record.action === "claim") {
    return { action: "claim" };
  }
  if (record.action === "release") {
    return { action: "release" };
  }
  if (record.action === "assign" && typeof record.assigneeId === "string") {
    return { action: "assign", assigneeId: record.assigneeId };
  }
  if (record.action === "reassign" && typeof record.assigneeId === "string") {
    return { action: "reassign", assigneeId: record.assigneeId };
  }
  return null;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const command = readCommand(body);
  if (!command) {
    return new Response(
      JSON.stringify({ error: "Invalid assignment action" }),
      {
        status: 400,
      },
    );
  }

  try {
    const result = transitionAssignment(db, id, user.id, command);
    if (result.kind === "chore_not_found") {
      return new Response(JSON.stringify({ error: "Chore not found" }), {
        status: 404,
      });
    }
    if (result.kind === "member_not_found") {
      return new Response(JSON.stringify({ error: "Member not found" }), {
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
    console.error("Failed to transition chore assignment:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};
