import type { AssignedNagScheduler } from "./assignedNagScheduler.ts";

interface Logger {
  info?(event: Record<string, unknown>): void;
  warn?(event: Record<string, unknown>): void;
  error?(event: Record<string, unknown>): void;
  log?(event: Record<string, unknown>): void;
}

export interface SchedulerStartOptions {
  scheduler: AssignedNagScheduler;
  getNow?: () => Date;
  setIntervalImpl?: (callback: () => void, intervalMs: number) => unknown;
  clearIntervalImpl?: (timer: unknown) => void;
  intervalMs?: number;
  logger?: Logger;
  enabled?: boolean;
}

export interface SchedulerOwner {
  stop(): void;
  readonly running: boolean;
}

let owner: SchedulerOwner | null = null;
let inFlight = false;

function info(logger: Logger | undefined, event: Record<string, unknown>) {
  const target = logger?.info ?? logger?.log;
  if (target) target.call(logger, event);
}

function warn(logger: Logger | undefined, event: Record<string, unknown>) {
  const target = logger?.warn ?? logger?.log;
  if (target) target.call(logger, event);
}

export function resolveNotificationsEnabled(
  getEnv: (name: string) => string | undefined,
): boolean {
  const raw = getEnv("ENABLE_NOTIFICATIONS")?.trim();
  if (!raw) return true;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error("ENABLE_NOTIFICATIONS must be true or false");
}

export function resetSchedulerForTests() {
  owner?.stop();
  owner = null;
  inFlight = false;
}

export function startScheduler(options: SchedulerStartOptions): SchedulerOwner {
  if (options.enabled === false) {
    info(options.logger, { event: "scheduler_disabled" });
    return {
      stop() {},
      get running() {
        return false;
      },
    };
  }
  if (owner?.running) return owner;

  let running = true;
  const getNow = options.getNow ?? (() => new Date());
  const setIntervalImpl = options.setIntervalImpl ??
    ((callback: () => void, interval: number) =>
      setInterval(callback, interval));
  const clearIntervalImpl = options.clearIntervalImpl ??
    ((timer: unknown) =>
      clearInterval(timer as ReturnType<typeof setInterval>));
  const intervalMs = options.intervalMs ?? 60_000;

  const tick = () => {
    if (!running || inFlight) return;
    inFlight = true;
    Promise.resolve(options.scheduler.tick(getNow()))
      .catch((error) => {
        warn(options.logger, {
          event: "scheduler_tick_failed",
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        inFlight = false;
      });
  };

  const timer = setIntervalImpl(tick, intervalMs);
  owner = {
    stop() {
      if (!running) return;
      running = false;
      clearIntervalImpl(timer);
      if (owner === this) owner = null;
      info(options.logger, { event: "scheduler_stopped" });
    },
    get running() {
      return running;
    },
  };
  info(options.logger, { event: "scheduler_started", intervalMs });
  tick();
  return owner;
}
