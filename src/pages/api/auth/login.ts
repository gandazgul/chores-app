import type { APIRoute } from "astro";
import { createSession, verifyGoogleToken } from "../../../utils/auth.ts";

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
    const sessionToken = await createSession(userPayload);

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
