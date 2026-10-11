import type { APIRoute } from "astro";
import db from "../../../../utils/db.ts";
import { notificationPort } from "../../../../notifications/notificationPort.ts";
import { resolveNotificationProvider } from "../../../../notifications/provider.ts";
import { resolveNotificationsEnabled } from "../../../../scheduler/lifecycle.ts";

const lastAttempt = new Map<string, number>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user) return json({ error: "Unauthorized" }, 401);
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(locals.user.id)) {
    return json({ error: "Not Found" }, 404);
  }
  const getEnv = (name: string) => Deno.env.get(name);
  if (
    resolveNotificationProvider(getEnv) !== "pushover" ||
    !resolveNotificationsEnabled(getEnv)
  ) {
    return json({
      error: "Pushover notifications are not enabled on the server.",
    }, 503);
  }
  const now = Date.now();
  if (now - (lastAttempt.get(locals.user.id) ?? 0) < 30_000) {
    return json({ error: "Wait 30 seconds before sending another test." }, 429);
  }
  lastAttempt.set(locals.user.id, now);
  const result = await notificationPort.send({
    recipientId: locals.user.id,
    title:
      "Test notification. Check that you can see and hear this on your phone.",
  });
  if (result.status === "sent") {
    return json({
      message:
        "Pushover accepted the test. Check your phone for the notification and sound.",
    });
  }
  if (result.status === "undeliverable") {
    return json({
      error:
        "The test was not accepted. Check or reconnect your Pushover user key.",
    }, 400);
  }
  return json({ error: "The test could not be sent. Try again shortly." }, 503);
};
