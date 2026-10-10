import { expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

test("member saves personal quiet hours, reloads, disables, and sees recoverable errors", async ({ page, request, baseURL }) => {
  await page.goto("/settings");
  await page.locator(
    'astro-island[component-url*="QuietHoursSettings"][client-render-time]',
  ).waitFor();
  await page.getByLabel("Enable quiet hours").check();
  await page.getByLabel("Pause reminders at").fill("01:00");
  await page.getByLabel("Resume reminders at").fill("09:00");
  await page.getByRole("button", { name: "Save quiet hours" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Quiet hours saved." }),
  ).toBeVisible();
  await page.reload();
  await page.locator(
    'astro-island[component-url*="QuietHoursSettings"][client-render-time]',
  ).waitFor();
  await expect(page.getByLabel("Pause reminders at")).toHaveValue("01:00");
  await expect(page.getByLabel("Resume reminders at")).toHaveValue("09:00");
  await page.getByLabel("Resume reminders at").fill("01:00");
  await page.getByRole("button", { name: "Save quiet hours" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "different start and end",
  );
  await page.getByLabel("Resume reminders at").fill("09:00");
  await page.route(
    "**/api/users/me/quiet-hours",
    (route) => route.fulfill({ status: 500 }),
  );
  await page.getByRole("button", { name: "Save quiet hours" }).click();
  await expect(page.getByRole("alert")).toContainText("please try again");
  await expect(page.getByLabel("Pause reminders at")).toHaveValue("01:00");
  await page.unroute("**/api/users/me/quiet-hours");
  await page.getByLabel("Enable quiet hours").uncheck();
  await expect(page.getByLabel("Pause reminders at")).toBeDisabled();
  await page.getByRole("button", { name: "Save quiet hours" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Quiet hours turned off." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Enable quiet hours")).not.toBeChecked();
  // The global same-origin middleware also protects the new endpoint.
  const rejected = await request.put("/api/users/me/quiet-hours", {
    headers: { origin: "https://other.example" },
    data: { enabled: true, start: "01:00", end: "09:00" },
  });
  expect(rejected.status()).toBe(403);
  await request.put("/api/users/me/quiet-hours", {
    headers: originHeaders(baseURL),
    data: { enabled: true, start: "01:00", end: "09:00" },
  });
  await page.reload();
  for (
    const [name, width, height] of [["desktop", 1280, 900], [
      "mobile",
      390,
      844,
    ]] as const
  ) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("button", { name: "Save quiet hours" }))
      .toBeVisible();
    expect(
      await page.evaluate(() =>
        document.documentElement.scrollWidth <= globalThis.innerWidth
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/tow-quiet-hours-${name}.png`,
      fullPage: true,
    });
    if (name === "mobile") {
      const tokenButton = page.getByRole("button", { name: "Save Token" });
      await tokenButton.scrollIntoViewIfNeeded();
      await tokenButton.click({ trial: true });
      const buttonBounds = await tokenButton.boundingBox();
      const footerBounds = await page.locator("footer").boundingBox();
      expect(buttonBounds!.y + buttonBounds!.height).toBeLessThanOrEqual(
        footerBounds!.y,
      );
      await page.screenshot({ path: "/tmp/tow-quiet-hours-mobile-bottom.png" });
    }
  }
});
