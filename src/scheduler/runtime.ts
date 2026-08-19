import db from "../utils/db.ts";
import { notificationPort } from "../notifications/notificationPort.ts";
import { resolveHouseholdTimeZone } from "../utils/householdTime.ts";
import { createAssignedNagScheduler } from "./assignedNagScheduler.ts";
import { resolveQuietHours } from "./nagPolicy.ts";
import { resolveNotificationsEnabled, startScheduler } from "./lifecycle.ts";

export function startRuntimeScheduler() {
  const enabled = resolveNotificationsEnabled((name) => Deno.env.get(name));
  const timeZone = resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ"));
  const quietHours = resolveQuietHours((name) => Deno.env.get(name));
  return startScheduler({
    scheduler: createAssignedNagScheduler({
      db,
      notificationPort,
      timeZone,
      quietHours,
      batchSize: 25,
      logger: console,
    }),
    enabled,
    logger: console,
  });
}
