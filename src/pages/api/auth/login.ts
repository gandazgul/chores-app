import type { APIRoute } from "astro";
import { createSession, verifyGoogleToken } from "../../../utils/auth.ts";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { credential } = await request.json();

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
      maxAge: 30 * 24 * 60 * 60, // 30 days
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
