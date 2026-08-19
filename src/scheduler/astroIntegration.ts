import { startRuntimeScheduler } from "./runtime.ts";

export function assignedNagSchedulerIntegration() {
  let owner: ReturnType<typeof startRuntimeScheduler> | null = null;
  return {
    name: "assigned-nag-scheduler",
    hooks: {
      "astro:server:setup"() {
        owner = startRuntimeScheduler();
      },
      "astro:server:done"() {
        owner?.stop();
        owner = null;
      },
    },
  };
}
