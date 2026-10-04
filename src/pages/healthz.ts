import type { APIRoute } from "astro";
import db from "../utils/db.ts";

export const GET: APIRoute = () => {
  try {
    db.prepare("SELECT 1").get();
    return new Response("ok", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("unavailable", { status: 503 });
  }
};
