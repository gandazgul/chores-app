import { assertEquals, assertNotEquals } from "@std/assert";
import { calculateNextOccurrence } from "./scheduleUtils.ts";

Deno.test("calculateNextOccurrence - Invalid RRULE", () => {
  const originalConsoleError = console.error;
  let errorCalledArgs: unknown[] | null = null;
  console.error = (...args: unknown[]) => {
    errorCalledArgs = args;
  };

  try {
    const result = calculateNextOccurrence("INVALID_STRING", new Date());
    assertEquals(result, null);
    assertNotEquals(errorCalledArgs, null);
    assertEquals(errorCalledArgs?.[0], "Invalid RRULE string: INVALID_STRING");
  } finally {
    console.error = originalConsoleError;
  }
});

Deno.test("calculateNextOccurrence - DAILY", () => {
  const rruleString = "FREQ=DAILY";
  const lastCompletedDate = new Date("2024-01-01T10:00:00Z");

  const result = calculateNextOccurrence(rruleString, lastCompletedDate);

  assertEquals(
    result?.toISOString(),
    new Date("2024-01-02T10:00:00Z").toISOString(),
  );
});

Deno.test("calculateNextOccurrence - WEEKLY on Mon,Wed,Fri", () => {
  const rruleString = "FREQ=WEEKLY;BYDAY=MO,WE,FR";
  const lastCompletedDate = new Date("2024-01-01T10:00:00Z");

  const result = calculateNextOccurrence(rruleString, lastCompletedDate);

  assertEquals(
    result?.toISOString(),
    new Date("2024-01-03T10:00:00Z").toISOString(),
  );

  const result2 = calculateNextOccurrence(rruleString, result);
  assertEquals(
    result2?.toISOString(),
    new Date("2024-01-05T10:00:00Z").toISOString(),
  );

  const result3 = calculateNextOccurrence(rruleString, result2);
  assertEquals(
    result3?.toISOString(),
    new Date("2024-01-08T10:00:00Z").toISOString(),
  );
});

Deno.test("calculateNextOccurrence - No lastCompletedDate uses current date", () => {
  const rruleString = "FREQ=DAILY";
  const now = new Date();
  const result = calculateNextOccurrence(rruleString);

  assertNotEquals(result, null);
  assertEquals((result?.getTime() ?? 0) > now.getTime(), true);
});
