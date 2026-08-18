import { assertEquals } from "@std/assert";
import {
  assignedNagSlots,
  resolveQuietHours,
  testInternals,
} from "./nagPolicy.ts";

Deno.test("assigned Nag ladder uses due, plus one hour, plus four hours, then 18:00", () => {
  const slots = assignedNagSlots({
    dueDate: "2030-01-01T10:00:00.000Z",
    fromExclusive: "2030-01-01T09:59:59.000Z",
    now: new Date("2030-01-01T18:00:00.000Z"),
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
  });

  assertEquals(slots.map((slot) => slot.slotKey), [
    "2030-01-01T10:00:00.000Z",
    "2030-01-01T11:00:00.000Z",
    "2030-01-01T14:00:00.000Z",
    "2030-01-01T18:00:00.000Z",
  ]);
});

Deno.test("quiet hours defer overnight Nag slots to one 09:00 delivery time", () => {
  const slots = assignedNagSlots({
    dueDate: "2030-01-01T22:00:00.000Z",
    fromExclusive: "2030-01-01T21:59:59.000Z",
    now: new Date("2030-01-02T09:00:00.000Z"),
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "09:00" },
  });

  assertEquals(slots.map((slot) => slot.deliverAfter), [
    "2030-01-02T09:00:00.000Z",
    "2030-01-02T09:00:00.000Z",
    "2030-01-02T09:00:00.000Z",
    "2030-01-02T09:00:00.000Z",
  ]);
});

Deno.test("late assignment starts at the next new ladder slot with no backfill", () => {
  const slots = assignedNagSlots({
    dueDate: "2030-01-01T10:00:00.000Z",
    fromExclusive: "2030-01-04T14:00:00.000Z",
    now: new Date("2030-01-04T18:00:00.000Z"),
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
  });

  assertEquals(slots.map((slot) => slot.slotKey), [
    "2030-01-04T18:00:00.000Z",
  ]);
});

Deno.test("household local 09:00 remains stable across daylight saving changes", () => {
  const slots = assignedNagSlots({
    dueDate: "2030-03-08T15:00:00.000Z",
    fromExclusive: "2030-03-09T00:00:00.000Z",
    now: new Date("2030-03-11T14:00:00.000Z"),
    timeZone: "America/New_York",
    quietHours: { start: "21:00", end: "08:00" },
  });
  const localHours = slots
    .filter((slot) => slot.slotKey.endsWith("13:00:00.000Z"))
    .map((slot) =>
      testInternals.localParts(new Date(slot.slotKey), "America/New_York").hour
    );

  assertEquals(localHours, [9, 9]);
});

Deno.test("quiet-hour configuration validates HH:MM values", () => {
  assertEquals(resolveQuietHours(() => undefined), {
    start: "21:00",
    end: "08:00",
  });
  assertEquals(
    resolveQuietHours((name) =>
      name === "QUIET_HOURS_START" ? "20:30" : "07:15"
    ),
    { start: "20:30", end: "07:15" },
  );
});
