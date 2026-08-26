import { assertEquals } from "@std/assert";
import {
  assignedNagSlots,
  poolBlastSlot,
  resolvePoolBlastLeadHours,
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

Deno.test("quiet-hours release skips a deferred slot when the next ladder point is within one hour", () => {
  const slots = assignedNagSlots({
    dueDate: "2030-01-01T07:30:00.000Z",
    fromExclusive: "2030-01-01T07:29:59.000Z",
    now: new Date("2030-01-01T08:30:00.000Z"),
    timeZone: "UTC",
    quietHours: { start: "21:00", end: "08:00" },
  });

  assertEquals(slots, [
    {
      slotKey: "2030-01-01T08:30:00.000Z",
      deliverAfter: "2030-01-01T08:30:00.000Z",
    },
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

Deno.test("Pool Blast lead-hours configuration is opt-in", () => {
  assertEquals(resolvePoolBlastLeadHours(() => undefined), null);
  assertEquals(resolvePoolBlastLeadHours(() => ""), null);
  assertEquals(resolvePoolBlastLeadHours(() => " 0 "), null);
  assertEquals(resolvePoolBlastLeadHours(() => "24"), 24);
});

Deno.test("Pool Blast lead-hours configuration rejects invalid values", () => {
  for (const value of ["-1", "1.5", "soon", "0x10"]) {
    try {
      resolvePoolBlastLeadHours(() => value);
      throw new Error("expected configuration error");
    } catch (error) {
      assertEquals(
        error instanceof Error &&
          error.message.includes("POOL_BLAST_LEAD_HOURS"),
        true,
      );
    }
  }
});

Deno.test("Pool Blast slot uses due date minus lead hours", () => {
  assertEquals(
    poolBlastSlot({
      dueDate: "2030-01-02T10:30:45.789Z",
      leadHours: 24,
      timeZone: "UTC",
      quietHours: { start: "21:00", end: "08:00" },
    }),
    {
      slotKey: "2030-01-01T10:30:45.000Z",
      deliverAfter: "2030-01-01T10:30:45.000Z",
    },
  );
});

Deno.test("Pool Blast slot applies Quiet Hours without forward coalescing", () => {
  assertEquals(
    poolBlastSlot({
      dueDate: "2030-01-02T06:30:00.000Z",
      leadHours: 24,
      timeZone: "UTC",
      quietHours: { start: "21:00", end: "08:00" },
    }),
    {
      slotKey: "2030-01-01T06:30:00.000Z",
      deliverAfter: "2030-01-01T08:00:00.000Z",
    },
  );
});

Deno.test("Pool Blast slot is absent when disabled or anchorless", () => {
  assertEquals(
    poolBlastSlot({
      dueDate: "2030-01-02T10:30:00.000Z",
      leadHours: null,
      timeZone: "UTC",
      quietHours: { start: "21:00", end: "08:00" },
    }),
    null,
  );
  assertEquals(
    poolBlastSlot({
      dueDate: null,
      leadHours: 24,
      timeZone: "UTC",
      quietHours: { start: "21:00", end: "08:00" },
    }),
    null,
  );
});
