import type { APIRoute } from "astro";
import type { UserPayload } from "../../../types.ts";
import db from "../../../utils/db.ts";
import {
  createSession,
  isEmailAllowed,
  verifyGoogleToken,
} from "../../../utils/auth.ts";

export async function createAuthorizedSession(
  user: UserPayload,
): Promise<string> {
  if (!isEmailAllowed(user.email)) {
    throw new Error("User email is not allowed");
  }

  db.prepare(`
    INSERT INTO users (id, email, name, picture)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      updated_at = CURRENT_TIMESTAMP
  `).run(user.id, user.email, user.name, user.picture ?? null);

  return await createSession(user);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: unknown = await request.json();
    const credential = typeof body === "object" && body !== null &&
        "credential" in body && typeof body.credential === "string"
      ? body.credential
      : undefined;

    if (!credential) {
      return new Response(JSON.stringify({ error: "Missing credential" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userPayload = await verifyGoogleToken(credential);
    const sessionToken = await createAuthorizedSession(userPayload);

    cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: Deno.env.get("COOKIE_SECURE") !== "false",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};
