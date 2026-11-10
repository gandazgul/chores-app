import { importPKCS8, SignJWT } from "jose";
import type { DatabaseSync } from "node:sqlite";
import type { NotificationPort, NotificationSendResult } from "../types.ts";

interface Credentials {
  projectId: string;
  accessToken: string;
}
interface TokenOptions {
  readServiceAccount(): unknown;
  fetchImpl: typeof fetch;
}

/** Credentials stay on the server; tokens are cached only in memory. */
export function createFcmAccessToken(options: TokenOptions) {
  let cached: (Credentials & { expiresAt: number }) | null = null;
  let pending: Promise<Credentials | null> | null = null;
  async function refresh(): Promise<Credentials | null> {
    const raw = options.readServiceAccount();
    if (!raw) return null;
    const account = raw as Record<string, unknown>;
    if (
      typeof account.project_id !== "string" ||
      !/^[a-z0-9-]+$/u.test(account.project_id) ||
      typeof account.client_email !== "string" ||
      typeof account.private_key !== "string"
    ) {
      throw new Error("Invalid FCM service account configuration");
    }
    const key = await importPKCS8(account.private_key, "RS256");
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256" }).setIssuer(account.client_email)
      .setAudience("https://oauth2.googleapis.com/token").setIssuedAt()
      .setExpirationTime("1h").sign(key);
    const response = await options.fetchImpl(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("FCM authorization failed");
    }
    const payload = await response.json();
    if (
      typeof payload.access_token !== "string" ||
      typeof payload.expires_in !== "number" || payload.expires_in < 60
    ) {
      throw new Error("Invalid FCM authorization response");
    }
    cached = {
      projectId: account.project_id,
      accessToken: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in - 60) * 1000,
    };
    return cached;
  }
  return (): Promise<Credentials | null> => {
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached);
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  };
}

export function createFcmNotificationPort(options: {
  db: DatabaseSync;
  fetchImpl: typeof fetch;
  getCredentials(): Promise<Credentials | null>;
}): NotificationPort {
  return {
    async send(input): Promise<NotificationSendResult> {
      const devices = options.db.prepare(
        "SELECT installation_id, token FROM mobile_devices WHERE user_id = ?",
      )
        .all(input.recipientId) as unknown as {
          installation_id: string;
          token: string;
        }[];
      if (!devices.length) {
        return { status: "undeliverable", reason: "missing_token" };
      }
      let credentials: Credentials | null;
      try {
        credentials = await options.getCredentials();
      } catch {
        return { status: "retryable_failure", reason: "fcm_unavailable" };
      }
      if (!credentials) return { status: "disabled" };
      let sent = false;
      let retry = false;
      let rejected = false;
      for (const device of devices) {
        try {
          const response = await options.fetchImpl(
            `https://fcm.googleapis.com/v1/projects/${credentials.projectId}/messages:send`,
            {
              method: "POST",
              signal: AbortSignal.timeout(15_000),
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${credentials.accessToken}`,
              },
              body: JSON.stringify({
                message: {
                  token: device.token,
                  notification: { title: "Tow", body: input.title },
                  data: { screen: "chores" },
                  android: {
                    priority: "high",
                    ttl: "3600s",
                    notification: {
                      channel_id: "tow_reminders_v1",
                      sound: "default",
                      icon: "ic_notification",
                    },
                  },
                },
              }),
            },
          );
          const body = await response.json().catch(() => null);
          if (response.ok) {
            sent = true;
            continue;
          }
          const unregistered = body?.error?.details?.some((
            detail: Record<string, unknown>,
          ) =>
            detail["@type"] ===
              "type.googleapis.com/google.firebase.fcm.v1.FcmError" &&
            detail.errorCode === "UNREGISTERED"
          );
          if (unregistered) {
            // Guard against token rotation while the send was in flight.
            options.db.prepare(
              "DELETE FROM mobile_devices WHERE installation_id = ? AND token = ?",
            )
              .run(device.installation_id, device.token);
          } else if (
            response.status === 429 || response.status >= 500 ||
            response.status === 401
          ) {
            retry = true;
          } else rejected = true;
        } catch {
          retry = true;
        }
      }
      // Existing outbox is at least once. A partial multi-device retry may duplicate a send.
      if (retry) {
        return { status: "retryable_failure", reason: "fcm_unavailable" };
      }
      if (sent) return { status: "sent" };
      return {
        status: "undeliverable",
        reason: rejected ? "fcm_rejected" : "missing_token",
      };
    },
  };
}
