import { assertEquals, assertThrows } from "@std/assert";
import {
  formatHouseholdDueDate,
  householdDateKey,
  resolveHouseholdTimeZone,
  selectWhatsNextChores,
  type WhatsNextCandidate,
} from "./householdTime.ts";

function chore(
  id: string,
  fields: Partial<WhatsNextCandidate> = {},
): WhatsNextCandidate {
  return {
    id,
    status: fields.status ?? "open",
    assignee_id: "assignee_id" in fields
      ? fields.assignee_id ?? null
      : "member-1",
    due_date: "due_date" in fields
      ? fields.due_date ?? null
      : "2030-01-01T12:00:00.000Z",
  };
}

Deno.test("household timezone resolves UTC by default and rejects invalid configured values", () => {
  assertEquals(resolveHouseholdTimeZone(undefined), "UTC");
  assertEquals(resolveHouseholdTimeZone(""), "UTC");
  assertEquals(
    resolveHouseholdTimeZone(" America/New_York "),
    "America/New_York",
  );

  assertThrows(
    () => resolveHouseholdTimeZone("Not/AZone"),
    Error,
    "HOUSEHOLD_TZ must be a valid IANA timezone",
  );
});

Deno.test("household date keys use the configured timezone around UTC midnight", () => {
  const instant = "2030-03-04T02:30:00.000Z";

  assertEquals(householdDateKey(instant, "UTC"), "2030-03-04");
  assertEquals(householdDateKey(instant, "America/New_York"), "2030-03-03");
});

Deno.test("household date keys stay stable across a daylight-saving boundary", () => {
  assertEquals(
    householdDateKey("2030-03-10T06:30:00.000Z", "America/New_York"),
    "2030-03-10",
  );
  assertEquals(
    householdDateKey("2030-03-10T07:30:00.000Z", "America/New_York"),
    "2030-03-10",
  );
});

Deno.test("due date display uses the explicit household timezone", () => {
  const utcLabel = formatHouseholdDueDate("2030-03-04T02:30:00.000Z", "UTC");
  const newYorkLabel = formatHouseholdDueDate(
    "2030-03-04T02:30:00.000Z",
    "America/New_York",
  );

  assertEquals(utcLabel?.includes("Mar 4"), true);
  assertEquals(newYorkLabel?.includes("Mar 3"), true);
});

Deno.test("What's Next selects today before overdue buckets", () => {
  const selection = selectWhatsNextChores(
    [
      chore("today", { due_date: "2030-05-10T12:00:00.000Z" }),
      chore("newer-overdue", { due_date: "2030-05-09T12:00:00.000Z" }),
      chore("oldest-overdue", { due_date: "2030-05-01T12:00:00.000Z" }),
    ],
    "member-1",
    new Date("2030-05-10T15:00:00.000Z"),
    "UTC",
  );

  assertEquals(selection.dateKey, "2030-05-10");
  assertEquals(selection.chores.map((item) => item.id), ["today"]);
});

Deno.test("What's Next selects today before the nearest future bucket", () => {
  const selection = selectWhatsNextChores(
    [
      chore("future", { due_date: "2030-05-12T12:00:00.000Z" }),
      chore("today", { due_date: "2030-05-10T12:00:00.000Z" }),
    ],
    "member-1",
    new Date("2030-05-10T15:00:00.000Z"),
    "UTC",
  );

  assertEquals(selection.dateKey, "2030-05-10");
  assertEquals(selection.chores.map((item) => item.id), ["today"]);
});

Deno.test("What's Next selects the nearest future bucket when there is no today work", () => {
  const selection = selectWhatsNextChores(
    [
      chore("overdue", { due_date: "2030-05-01T12:00:00.000Z" }),
      chore("later", { due_date: "2030-05-15T12:00:00.000Z" }),
      chore("nearest", { due_date: "2030-05-12T12:00:00.000Z" }),
    ],
    "member-1",
    new Date("2030-05-10T15:00:00.000Z"),
    "UTC",
  );

  assertEquals(selection.dateKey, "2030-05-12");
  assertEquals(selection.chores.map((item) => item.id), ["nearest"]);
});

Deno.test("What's Next excludes unscheduled, malformed, completed, unassigned, and other-member rows", () => {
  const selection = selectWhatsNextChores(
    [
      chore("unscheduled", { due_date: null }),
      chore("malformed", { due_date: "nope" }),
      chore("completed", {
        status: "completed",
        due_date: "2030-05-10T12:00:00.000Z",
      }),
      chore("pool", {
        assignee_id: null,
        due_date: "2030-05-10T12:00:00.000Z",
      }),
      chore("other", {
        assignee_id: "member-2",
        due_date: "2030-05-10T12:00:00.000Z",
      }),
    ],
    "member-1",
    new Date("2030-05-10T15:00:00.000Z"),
    "UTC",
  );

  assertEquals(selection, { dateKey: null, chores: [] });
});
