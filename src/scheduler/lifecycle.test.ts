import { assertEquals } from "@std/assert";
import type { AssignedNagScheduler } from "./assignedNagScheduler.ts";
import {
  resetSchedulerForTests,
  resolveNotificationsEnabled,
  startScheduler,
} from "./lifecycle.ts";

Deno.test("startScheduler starts once immediately and does not overlap ticks", async () => {
  resetSchedulerForTests();
  let ticks = 0;
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => release = resolve);
  const scheduler: AssignedNagScheduler = {
    async tick() {
      ticks++;
      await blocker;
    },
  };

  const first = startScheduler({
    scheduler,
    logger: console,
  });
  const second = startScheduler({ scheduler, logger: console });

  assertEquals(first, second);
  assertEquals(ticks, 1);
  release();
  await Promise.resolve();
  first.stop();
  resetSchedulerForTests();
});

Deno.test("disabled scheduler creates no owner loop", () => {
  resetSchedulerForTests();
  let ticks = 0;
  const owner = startScheduler({
    scheduler: {
      tick: () => {
        ticks++;
        return Promise.resolve();
      },
    },
    enabled: false,
    logger: console,
  });

  assertEquals(owner.running, false);
  assertEquals(ticks, 0);
});

Deno.test("notification enablement accepts true false and default only", () => {
  assertEquals(resolveNotificationsEnabled(() => undefined), true);
  assertEquals(resolveNotificationsEnabled(() => "true"), true);
  assertEquals(resolveNotificationsEnabled(() => "false"), false);
  let message = "";
  try {
    resolveNotificationsEnabled(() => "maybe");
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, "ENABLE_NOTIFICATIONS must be true or false");
});
