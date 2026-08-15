import type { APIRoute } from "astro";
import type { Member } from "../../../types.ts";
import db from "../../../utils/db.ts";

export const GET: APIRoute = ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  try {
    const members = db.prepare(`
      SELECT id, name, picture
      FROM users
      ORDER BY COALESCE(name, ''), id
    `).all() as unknown as Member[];

    return new Response(JSON.stringify(members), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
};
