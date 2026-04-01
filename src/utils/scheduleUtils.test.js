import { assertEquals, assertNotEquals } from "@std/assert";
import { calculateNextOccurrence } from "./scheduleUtils.js";

Deno.test("calculateNextOccurrence - Invalid RRULE", () => {
  const originalConsoleError = console.error;
  /** @type {unknown[] | null} */
  let errorCalledArgs = null;
  console.error = (...args) => {
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

  // It should be exactly 24 hours later if rrule processes correctly
  assertEquals(
    result?.toISOString(),
    new Date("2024-01-02T10:00:00Z").toISOString(),
  );
});

Deno.test("calculateNextOccurrence - WEEKLY on Mon,Wed,Fri", () => {
  const rruleString = "FREQ=WEEKLY;BYDAY=MO,WE,FR";
  // Mon, Jan 1, 2024
  const lastCompletedDate = new Date("2024-01-01T10:00:00Z");

  const result = calculateNextOccurrence(rruleString, lastCompletedDate);

  // Next should be Wed, Jan 3, 2024
  assertEquals(
    result?.toISOString(),
    new Date("2024-01-03T10:00:00Z").toISOString(),
  );

  // If completed on Wednesday
  const result2 = calculateNextOccurrence(
    rruleString,
    /** @type {Date} */ (result),
  );
  // Next should be Fri, Jan 5, 2024
  assertEquals(
    result2?.toISOString(),
    new Date("2024-01-05T10:00:00Z").toISOString(),
  );

  // If completed on Friday
  const result3 = calculateNextOccurrence(
    rruleString,
    /** @type {Date} */ (result2),
  );
  // Next should be Mon, Jan 8, 2024
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
  // Just testing it doesn't fail and returns a date in the future
  assertEquals(/** @type {Date} */ (result).getTime() > now.getTime(), true);
});
