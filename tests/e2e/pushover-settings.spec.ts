import { expect, test } from "@playwright/test";
import process from "node:process";

test.skip(
  process.env.NOTIFICATION_PROVIDER !== "pushover",
  "Run with Pushover configured",
);

test("Pushover setup, recoverable errors, test message, and disconnect stay usable on mobile", async ({ page, request }) => {
  await page.goto("/settings");
  await page.locator(
    'astro-island[component-url*="PushoverSettings"][client-render-time]',
  ).waitFor();
  const section = page.getByRole("region", { name: "Pushover notifications" });
  const input = page.getByLabel("Pushover user key", { exact: true });
  await expect(input).toHaveAttribute("type", "password");
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send test notification" }))
    .toBeDisabled();
  await page.getByRole("button", { name: "Connect Pushover", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("30-character");
  const key = "u".repeat(30);
  await input.fill(key);
  await page.route(
    "**/api/users/me/pushover-key",
    (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Pushover could not be reached. Try again shortly." },
      }),
  );
  await page.getByRole("button", { name: "Connect Pushover", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not be reached");
  await expect(input).toHaveValue(key);
  await page.unroute("**/api/users/me/pushover-key");
  await page.route(
    "**/api/users/me/pushover-key",
    (route) =>
      route.fulfill({
        json: { pushoverConfigured: route.request().method() !== "DELETE" },
      }),
  );
  await page.getByRole("button", { name: "Connect Pushover", exact: true })
    .click();
  await expect(section.getByRole("status")).toContainText("Pushover connected");
  await expect(input).toHaveValue("");
  expect(await page.content()).not.toContain(key);
  await page.route(
    "**/api/users/me/test-notification",
    (route) =>
      route.fulfill({
        json: {
          message:
            "Pushover accepted the test. Check your phone for the notification and sound.",
        },
      }),
  );
  await page.getByRole("button", { name: "Send test notification" }).click();
  await expect(section.getByRole("status")).toContainText("accepted the test");
  const forbidden = await request.post("/api/users/me/test-notification", {
    headers: { origin: "https://other.example" },
  });
  expect(forbidden.status()).toBe(403);
  const forbiddenKey = await request.put("/api/users/me/pushover-key", {
    headers: { origin: "https://other.example" },
    data: { userKey: key },
  });
  expect(forbiddenKey.status()).toBe(403);
  for (
    const [name, width, height] of [["desktop", 1280, 1000], [
      "mobile",
      390,
      844,
    ]] as const
  ) {
    await page.setViewportSize({ width, height });
    await page.locator("main").last().evaluate((main) =>
      main.parentElement!.scrollTo(0, 0)
    );
    await page.screenshot({ path: `/tmp/tow-pushover-${name}.png` });
    const button = page.getByRole("button", { name: "Send test notification" });
    await button.scrollIntoViewIfNeeded();
    await button.click({ trial: true });
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    ).toBe(true);
    const bounds = await button.boundingBox(),
      footer = await page.locator("footer").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
    await page.screenshot({ path: `/tmp/tow-pushover-${name}-bottom.png` });
  }
  await page.unroute("**/api/users/me/test-notification");
  await page.route(
    "**/api/users/me/test-notification",
    (route) =>
      route.fulfill({
        status: 429,
        json: { error: "Wait 30 seconds before sending another test." },
      }),
  );
  await page.getByRole("button", { name: "Send test notification" }).click();
  await expect(page.getByRole("alert")).toContainText("Wait 30 seconds");
  await page.getByRole("button", { name: "Disconnect Pushover" }).click();
  await expect(section.getByRole("status")).toContainText("disconnected");
  await expect(page.getByRole("button", { name: "Send test notification" }))
    .toBeDisabled();
});
