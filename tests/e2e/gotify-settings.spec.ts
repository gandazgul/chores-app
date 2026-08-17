import { expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

const tokenText = "Gotify notification settings";

test.describe("Gotify notification settings", () => {
  test("member can navigate set replace reload clear without secret reflection", async ({ baseURL, page, request }) => {
    const firstToken = `${tokenText} first secret ${Date.now()}`;
    const secondToken = `${tokenText} second secret ${Date.now()}`;

    await page.goto("/");
    await expect(page).toHaveURL("/");
    await page.locator(
      'astro-island[component-url*="ChoreManager"][client-render-time]',
    ).waitFor({ state: "attached" });

    await page.getByRole("link", { name: "Notification settings" }).click();
    await expect(page).toHaveURL("/settings");
    await request.delete("/api/users/me/gotify-token", {
      headers: originHeaders(baseURL),
    });
    await page.reload();
    const input = page.getByLabel("Gotify Application Token");
    await expect(input).toHaveAttribute("type", "password");
    await expect(input).toHaveAttribute("autocomplete", "new-password");
    await expect(input).toHaveValue("");
    await expect(page.locator("section p", { hasText: /^Not configured$/ }))
      .toBeVisible();

    await input.fill(firstToken);
    const saveResponse = page.waitForResponse("**/api/users/me/gotify-token");
    await page.getByRole("button", { name: "Save Token" }).click();
    expect(await (await saveResponse).json()).toEqual({
      gotifyConfigured: true,
    });
    await expect(
      page.locator("div", { hasText: /^Notification settings saved\.$/ }),
    ).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(page.locator("section p", { hasText: /^Configured$/ }))
      .toBeVisible();
    await expect(page.locator("html")).not.toContainText(firstToken);
    expect(
      await page.evaluate(
        (secret) => document.documentElement.outerHTML.includes(secret),
        firstToken,
      ),
    ).toBe(false);

    await page.reload();
    await expect(page.locator("section p", { hasText: /^Configured$/ }))
      .toBeVisible();
    await expect(input).toHaveValue("");
    expect(
      await page.evaluate(
        (secret) => document.documentElement.outerHTML.includes(secret),
        firstToken,
      ),
    ).toBe(false);

    await input.fill(secondToken);
    await page.getByRole("button", { name: "Replace Token" }).click();
    await expect(
      page.locator("div", { hasText: /^Notification settings saved\.$/ }),
    ).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(page.locator("html")).not.toContainText(secondToken);

    const apiState = await request.put("/api/users/me/gotify-token", {
      headers: originHeaders(baseURL),
      data: { gotifyToken: `${tokenText} same-origin direct secret` },
    });
    expect(apiState.status()).toBe(200);
    expect(await apiState.json()).toEqual({ gotifyConfigured: true });

    await page.reload();
    await expect(page.locator("section p", { hasText: /^Configured$/ }))
      .toBeVisible();
    await page.getByRole("button", { name: "Clear Token" }).click();
    await expect(
      page.locator("div", { hasText: /^Notification settings cleared\.$/ }),
    )
      .toBeVisible();
    await expect(page.locator("section p", { hasText: /^Not configured$/ }))
      .toBeVisible();
    await expect(page.getByRole("button", { name: "Clear Token" }))
      .toBeDisabled();

    await page.getByRole("link", { name: "Back to chores" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("tab", { name: "What's Next" }))
      .toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "New Chore" })).toBeVisible();
  });
});
