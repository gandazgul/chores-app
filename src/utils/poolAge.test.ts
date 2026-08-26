import { assertEquals } from "@std/assert";
import { formatPoolAge } from "./poolAge.ts";

Deno.test("Pool age label uses less than a day before one full elapsed day", () => {
  assertEquals(
    formatPoolAge(
      "2030-01-01T10:00:00.000Z",
      new Date("2030-01-02T09:59:59.000Z").getTime(),
    ),
    "In Pool for less than a day",
  );
});

Deno.test("Pool age label uses singular day at one full elapsed day", () => {
  assertEquals(
    formatPoolAge(
      "2030-01-01T10:00:00.000Z",
      new Date("2030-01-02T10:00:00.000Z").getTime(),
    ),
    "In Pool for 1 day",
  );
});

Deno.test("Pool age label floors complete elapsed days", () => {
  assertEquals(
    formatPoolAge(
      "2030-01-01T10:00:00.000Z",
      new Date("2030-01-07T23:59:59.000Z").getTime(),
    ),
    "In Pool for 6 days",
  );
});

Deno.test("Pool age label is absent without a valid Pool-entry anchor", () => {
  assertEquals(formatPoolAge(null, Date.now()), null);
  assertEquals(formatPoolAge("not-a-date", Date.now()), null);
});

Deno.test("Pool age label does not show negative age for a future anchor", () => {
  assertEquals(
    formatPoolAge(
      "2030-01-02T10:00:00.000Z",
      new Date("2030-01-01T10:00:00.000Z").getTime(),
    ),
    "In Pool for less than a day",
  );
});
