/** A configured origin is authoritative; proxy headers never grant trust. */
export function resolvePublicOrigin(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) || url.username ||
    url.password ||
    url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("PUBLIC_ORIGIN must be an HTTP(S) origin without a path");
  }
  return url.origin;
}
