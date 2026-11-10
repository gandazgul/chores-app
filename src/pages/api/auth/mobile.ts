import type { APIRoute } from "astro";
import { verifyGoogleToken } from "../../../utils/auth.ts";
import { createAuthorizedSession } from "./login.ts";

export const POST: APIRoute = async ({ request }) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const body = await request.json().catch(() => null);
  if (typeof body?.credential !== "string" || body.credential.length > 16000) {
    return new Response(JSON.stringify({ error: "Missing credential" }), {
      status: 400,
      headers,
    });
  }
  try {
    const user = await verifyGoogleToken(body.credential);
    const token = await createAuthorizedSession(user, true);
    return new Response(JSON.stringify({ token, user }), { headers });
  } catch {
    return new Response(
      JSON.stringify({
        error: "Sign-in failed. Use an allowed household Google account.",
      }),
      { status: 401, headers },
    );
  }
};
