import "../src/utils/db.ts";
import { resolveGotifyConfig } from "../src/notifications/notificationPort.ts";
import { resolveNotificationsEnabled } from "../src/scheduler/lifecycle.ts";
import { resolveQuietHours } from "../src/scheduler/nagPolicy.ts";
import { startRuntimeScheduler } from "../src/scheduler/runtime.ts";
import { resolveHouseholdTimeZone } from "../src/utils/householdTime.ts";

resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ"));
resolveGotifyConfig((name) => Deno.env.get(name));
resolveNotificationsEnabled((name) => Deno.env.get(name));
resolveQuietHours((name) => Deno.env.get(name));

const scheduler = startRuntimeScheduler();

const stop = () => scheduler.stop();
try {
  Deno.addSignalListener("SIGTERM", stop);
  Deno.addSignalListener("SIGINT", stop);
} catch {
  // Some test runtimes do not allow signal listeners.
}

await import("../dist/server/entry.mjs");
