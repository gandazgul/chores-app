import { resolvePublicOrigin } from "../src/utils/publicOrigin.ts";
import "../src/utils/db.ts";
import { resolveGotifyConfig } from "../src/notifications/notificationPort.ts";
import { resolveNotificationsEnabled } from "../src/scheduler/lifecycle.ts";
import { resolveQuietHours } from "../src/scheduler/nagPolicy.ts";
import { startRuntimeScheduler } from "../src/scheduler/runtime.ts";
import { resolveHouseholdTimeZone } from "../src/utils/householdTime.ts";

const origin = resolvePublicOrigin(Deno.env.get("PUBLIC_ORIGIN"));
if (Deno.env.get("ENABLE_AUTH")?.toLowerCase() !== "false") {
  if (!origin?.startsWith("https://")) {
    throw new Error("Production authentication requires an HTTPS PUBLIC_ORIGIN");
  }
  for (const name of ["GOOGLE_CLIENT_ID", "SESSION_SECRET", "ALLOWED_EMAILS"]) {
    if (!Deno.env.get(name)?.trim()) throw new Error(`${name} is required`);
  }
  if (Deno.env.get("COOKIE_SECURE") === "false") {
    throw new Error("Production authentication requires secure cookies");
  }
}

resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ"));
resolveGotifyConfig((name) => Deno.env.get(name));
resolveNotificationsEnabled((name) => Deno.env.get(name));
resolveQuietHours((name) => Deno.env.get(name));

const scheduler = startRuntimeScheduler();

const server = await import("../dist/server/entry.mjs");
const stop = async () => {
  scheduler.stop();
  await server.stop();
  Deno.removeSignalListener("SIGTERM", stop);
  Deno.removeSignalListener("SIGINT", stop);
};
try {
  Deno.addSignalListener("SIGTERM", stop);
  Deno.addSignalListener("SIGINT", stop);
} catch {
  // Some test runtimes do not allow signal listeners.
}
