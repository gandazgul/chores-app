import db from "../utils/db.ts";
import type {
  NotificationPort,
  NotificationSendInput,
  NotificationSendResult,
} from "../types.ts";

interface GotifyTokenRow {
  gotify_token: string | null;
}

interface NotificationLogger {
  info?(event: Record<string, unknown>): void;
  warn?(event: Record<string, unknown>): void;
  error?(event: Record<string, unknown>): void;
  log?(event: Record<string, unknown>): void;
}

export interface GotifyNotificationPortOptions {
  getEnv(name: string): string | undefined;
  fetchImpl(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response>;
  logger: NotificationLogger;
}

export interface GotifyConfig {
  messageUrl: string;
  origin: string;
}

function loggerInfo(
  logger: NotificationLogger,
  event: Record<string, unknown>,
) {
  if (logger.info) logger.info(event);
  else if (logger.log) logger.log(event);
}

function loggerWarn(
  logger: NotificationLogger,
  event: Record<string, unknown>,
) {
  if (logger.warn) logger.warn(event);
  else if (logger.log) logger.log(event);
}

function isLoopbackHttp(url: URL): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export function resolveGotifyConfig(
  getEnv: (name: string) => string | undefined,
): GotifyConfig | null {
  const rawUrl = getEnv("GOTIFY_URL")?.trim();
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("GOTIFY_URL is not a valid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("GOTIFY_URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("GOTIFY_URL must not include credentials");
  }
  if (url.search || url.hash) {
    throw new Error("GOTIFY_URL must not include a query string or fragment");
  }
  if (url.protocol === "http:" && !isLoopbackHttp(url)) {
    const allowInsecure = getEnv("ALLOW_INSECURE_GOTIFY") === "true";
    if (!allowInsecure) {
      throw new Error(
        "GOTIFY_URL must use HTTPS unless ALLOW_INSECURE_GOTIFY=true is set for a trusted local network",
      );
    }
  }

  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/message`;
  return { messageUrl: url.toString(), origin: url.origin };
}

function tokenFor(recipientId: string): string | null {
  const row = db.prepare("SELECT gotify_token FROM users WHERE id = ?")
    .get(recipientId) as unknown as GotifyTokenRow | undefined;
  return row?.gotify_token ?? null;
}

function classifyStatus(status: number): NotificationSendResult {
  if (status >= 200 && status < 300) return { status: "sent" };
  if (status === 401 || status === 403) {
    return { status: "undeliverable", reason: "auth_rejected" };
  }
  if (status === 429 || status >= 500) {
    return { status: "retryable_failure", reason: "gotify_unavailable" };
  }
  return { status: "undeliverable", reason: "gotify_rejected" };
}

export function createNotificationPort(
  options: GotifyNotificationPortOptions,
): NotificationPort {
  return {
    async send(input: NotificationSendInput): Promise<NotificationSendResult> {
      const token = tokenFor(input.recipientId);
      if (!token) {
        return { status: "undeliverable", reason: "missing_token" };
      }

      const config = resolveGotifyConfig(options.getEnv);
      if (!config) {
        const result: NotificationSendResult = { status: "disabled" };
        loggerInfo(options.logger, {
          event: "push_notification_disabled",
          recipientId: input.recipientId,
          result: result.status,
        });
        return result;
      }

      try {
        const response = await options.fetchImpl(config.messageUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Gotify-Key": token,
          },
          body: JSON.stringify({ message: `TOW: ${input.title}` }),
        });
        const result = classifyStatus(response.status);
        if (result.status !== "sent") {
          loggerWarn(options.logger, {
            event: "push_notification_gotify_failure",
            recipientId: input.recipientId,
            origin: config.origin,
            httpStatus: response.status,
            result: result.status,
          });
        }
        return result;
      } catch {
        const result: NotificationSendResult = {
          status: "retryable_failure",
          reason: "network_error",
        };
        loggerWarn(options.logger, {
          event: "push_notification_gotify_failure",
          recipientId: input.recipientId,
          origin: config.origin,
          result: result.status,
        });
        return result;
      }
    },
  };
}

export const notificationPort = createNotificationPort({
  getEnv: (name) => Deno.env.get(name),
  fetchImpl: fetch,
  logger: console,
});
