export function originHeaders(baseURL: string | undefined): { Origin: string } {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for mutation requests");
  }

  return { Origin: new URL(baseURL).origin };
}

export function invalidOriginCases(
  baseURL: string | undefined,
): Array<{ name: string; origin?: string }> {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required for CSRF tests");
  }

  const base = new URL(baseURL);
  const wrongPort = new URL(base);
  wrongPort.port = String(Number(base.port || "80") + 1);

  const wrongScheme = new URL(base);
  wrongScheme.protocol = base.protocol === "http:" ? "https:" : "http:";

  return [
    { name: "missing origin" },
    { name: "foreign host", origin: "http://evil.example" },
    { name: "same host with wrong scheme", origin: wrongScheme.origin },
    { name: "same host with wrong port", origin: wrongPort.origin },
    {
      name: "localhost alias",
      origin: `${base.protocol}//localhost:${base.port}`,
    },
  ];
}
