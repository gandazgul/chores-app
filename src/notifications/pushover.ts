import type { DatabaseSync } from "node:sqlite";
import type { NotificationPort, NotificationSendResult } from "../types.ts";

export function parsePushoverKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return /^[A-Za-z0-9]{30}$/u.test(key) ? key : null;
}

export function resolvePushoverToken(
  getEnv: (name: string) => string | undefined,
): string | null {
  const raw = getEnv("PUSHOVER_APP_TOKEN")?.trim();
  if (!raw) return null;
  const token = parsePushoverKey(raw);
  if (!token) {
    throw new Error("PUSHOVER_APP_TOKEN must be a 30-character API token");
  }
  return token;
}

interface PushoverOptions {
  getEnv(name: string): string | undefined;
  fetchImpl: typeof fetch;
}

export function createPushoverClient(options: PushoverOptions) {
  async function request(
    endpoint: "messages" | "users/validate",
    user: string,
    fields: Record<string, string | number> = {},
  ): Promise<NotificationSendResult> {
    const token = resolvePushoverToken(options.getEnv);
    if (!token) return { status: "disabled" };
    try {
      const response = await options.fetchImpl(
        `https://api.pushover.net/1/${endpoint}.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, user, ...fields }),
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        },
      );
      // Pushover requires both HTTP success and status:1 in its JSON body.
      // Never log or return provider response bodies: they can echo credentials.
      const body = await response.json().catch(() => null);
      if (response.status === 429 || response.status >= 500) {
        return { status: "retryable_failure", reason: "pushover_unavailable" };
      }
      if (response.ok && body?.status === 1) return { status: "sent" };
      if (response.ok && body?.status !== 0) {
        return { status: "retryable_failure", reason: "pushover_unavailable" };
      }
      return { status: "undeliverable", reason: "pushover_rejected" };
    } catch {
      return { status: "retryable_failure", reason: "network_error" };
    }
  }
  return {
    validate: (user: string) => request("users/validate", user),
    send: (user: string, title: string) =>
      request("messages", user, {
        title: "Tow",
        message: [...`TOW: ${title}`].slice(0, 1024).join(""),
        priority: 0,
        sound: "pushover",
      }),
  };
}

export function createPushoverNotificationPort(
  options: PushoverOptions & {
    db: DatabaseSync;
    logger: { warn?(event: Record<string, unknown>): void };
  },
): NotificationPort {
  const client = createPushoverClient(options);
  return {
    async send(input) {
      const row = options.db.prepare(
        "SELECT pushover_user_key FROM users WHERE id = ?",
      ).get(input.recipientId);
      const key = parsePushoverKey(row?.pushover_user_key);
      if (!key) return { status: "undeliverable", reason: "missing_token" };
      const result = await client.send(key, input.title);
      if (result.status !== "sent") {
        options.logger.warn?.({
          event: "push_notification_pushover_failure",
          recipientId: input.recipientId,
          result: result.status,
          reason: "reason" in result ? result.reason : undefined,
        });
      }
      return result;
    },
  };
}
