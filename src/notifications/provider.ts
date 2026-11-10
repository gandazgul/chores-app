export function resolveNotificationProvider(
  getEnv: (name: string) => string | undefined,
): "gotify" | "pushover" | "fcm" {
  const provider = getEnv("NOTIFICATION_PROVIDER")?.trim() || "gotify";
  if (provider !== "gotify" && provider !== "pushover" && provider !== "fcm") {
    throw new Error("NOTIFICATION_PROVIDER must be gotify, pushover, or fcm");
  }
  return provider;
}
