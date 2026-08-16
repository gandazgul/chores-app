import "../src/utils/db.ts";
import { resolveHouseholdTimeZone } from "../src/utils/householdTime.ts";

resolveHouseholdTimeZone(Deno.env.get("HOUSEHOLD_TZ"));

await import("../dist/server/entry.mjs");
