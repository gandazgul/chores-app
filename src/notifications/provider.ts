export function resolveNotificationProvider(
  getEnv: (name: string) => string | undefined,
): "gotify" | "pushover" {
  const provider = getEnv("NOTIFICATION_PROVIDER")?.trim() || "gotify";
  if (provider !== "gotify" && provider !== "pushover") {
    throw new Error("NOTIFICATION_PROVIDER must be gotify or pushover");
  }
  return provider;
}
