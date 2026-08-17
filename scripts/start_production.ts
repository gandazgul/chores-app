import "../src/utils/db.ts";
import { resolveGotifyConfig } from "../src/notifications/notificationPort.ts";
import { resolveHouseholdTimeZone } from "../src/utils/householdTime.ts";

resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ"));
resolveGotifyConfig((name) => Deno.env.get(name));

await import("../dist/server/entry.mjs");
