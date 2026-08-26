import { type APIRequestContext, expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

interface ChoreResponse {
  id: string;
  title: string;
  assignee_id: string | null;
  status: "open" | "completed" | "skipped";
  resolved_at?: string | null;
}

async function createChore(
  request: APIRequestContext,
  baseURL: string | undefined,
  body: Record<string, unknown>,
): Promise<ChoreResponse> {
  const response = await request.post("/api/chores", {
    data: body,
    headers: originHeaders(baseURL),
  });
  expect(response.status()).toBe(201);
  return await response.json() as ChoreResponse;
}

async function cleanupChores(
  request: APIRequestContext,
  baseURL: string | undefined,
  testId: string,
) {
  const response = await request.get("/api/chores");
  expect(response.status()).toBe(200);
  const chores = await response.json() as ChoreResponse[];
  for (const chore of chores) {
    if (chore.title.includes(testId)) {
      await request.delete(`/api/chores/${chore.id}`, {
        headers: originHeaders(baseURL),
      });
    }
  }
}

test.describe("Three view chore journey", () => {
  test("Skip remains active and survives refresh", async ({ baseURL, page, request }) => {
    const testId = Date.now().toString();
    const title = `Skip Active Refresh ${testId}`;
    try {
      const created = await createChore(request, baseURL, {
        title,
        dueDate: new Date().toISOString(),
      });

      await page.goto("/");
      await page.locator(
        'astro-island[component-url*="ChoreManager"][client-render-time]',
      ).waitFor({ state: "attached" });
      await page.getByRole("tab", { name: "Board" }).click();

      const row = page.locator("li").filter({ hasText: title });
      await expect(row).toBeVisible();
      const skipResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/chores/${created.id}`) &&
        response.request().method() === "PUT"
      );
      await row.getByRole("button", { name: "Skip" }).click();
      await expect((await skipResponse).status()).toBe(200);
      await expect(row).toContainText("Skipped");
      await expect(row.getByRole("button", { name: /Undo skip/i }))
        .toBeVisible();

      const afterSkip = await request.get("/api/chores");
      const chores = await afterSkip.json() as ChoreResponse[];
      const skipped = chores.find((chore) => chore.id === created.id);
      expect(skipped?.status).toBe("skipped");
      expect(typeof skipped?.resolved_at).toBe("string");

      await page.reload();
      await page.locator(
        'astro-island[component-url*="ChoreManager"][client-render-time]',
      ).waitFor({ state: "attached" });
      await page.getByRole("tab", { name: "Board" }).click();
      await expect(row).toBeVisible();
      await expect(row).toContainText("Skipped");
      const undoResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/chores/${created.id}`) &&
        response.request().method() === "PUT"
      );
      await row.getByRole("button", { name: /Undo skip/i }).click();
      await expect((await undoResponse).status()).toBe(200);
      await expect(row.getByRole("button", { name: "Mark as done" }))
        .toBeVisible();
      await expect(row).not.toContainText("Skipped");
    } finally {
      await cleanupChores(request, baseURL, testId);
    }
  });

  test("Skipped chore moves to Done when Undo expires", async ({ baseURL, page, request }) => {
    test.setTimeout(60_000);
    const testId = Date.now().toString();
    const title = `Skip Expiry ${testId}`;

    try {
      await createChore(request, baseURL, {
        title,
        dueDate: new Date().toISOString(),
      });

      await page.goto("/");
      await page.locator(
        'astro-island[component-url*="ChoreManager"][client-render-time]',
      ).waitFor({ state: "attached" });
      await page.getByRole("tab", { name: "Board" }).click();
      const row = page.locator("li").filter({ hasText: title });
      await row.getByRole("button", { name: "Skip" }).click();
      await expect(row.getByRole("button", { name: /Undo skip/i }))
        .toBeVisible();

      await expect(row.getByRole("button", { name: /Undo skip/i }))
        .toHaveCount(0, { timeout: 35_000 });
      const done = page.locator("details").filter({
        hasText: "Done household chores",
      });
      await done.locator("summary").click();
      await expect(done.locator("li").filter({ hasText: title }))
        .toContainText("Skipped");
      await expect(
        done.locator("li").filter({ hasText: title }).locator(
          "button[aria-label='Mark as done']",
        ),
      ).toHaveCount(0);
    } finally {
      await cleanupChores(request, baseURL, testId);
    }
  });

  test("What's Next, Board, Pool, search, Done, and reopen work together", async ({ baseURL, page, request }) => {
    const testId = Date.now().toString();
    const overdueTitle = `Three View Overdue ${testId}`;
    const todayTitle = `Three View Today ${testId}`;
    const futureTitle = `Three View Future ${testId}`;
    const poolTitle = `Three View Pool ${testId}`;
    const doneTitle = `Three View Done Search ${testId}`;
    const now = new Date();
    const todayNoon = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
    );
    const todayAfternoon = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13),
    );
    const yesterdayNoon = new Date(todayNoon);
    yesterdayNoon.setUTCDate(yesterdayNoon.getUTCDate() - 1);
    const tomorrowNoon = new Date(todayNoon);
    tomorrowNoon.setUTCDate(tomorrowNoon.getUTCDate() + 1);

    try {
      await createChore(request, baseURL, {
        title: overdueTitle,
        dueDate: yesterdayNoon.toISOString(),
      });
      await createChore(request, baseURL, {
        title: todayTitle,
        dueDate: todayAfternoon.toISOString(),
      });
      await createChore(request, baseURL, {
        title: futureTitle,
        dueDate: todayNoon.toISOString(),
      });
      const pool = await createChore(request, baseURL, {
        title: poolTitle,
        assigneeId: null,
        dueDate: tomorrowNoon.toISOString(),
      });
      const done = await createChore(request, baseURL, {
        title: doneTitle,
        dueDate: tomorrowNoon.toISOString(),
      });
      const doneResponse = await request.put(`/api/chores/${done.id}`, {
        data: { done: true },
        headers: originHeaders(baseURL),
      });
      expect(doneResponse.status()).toBe(200);

      await page.goto("/");
      await page.locator(
        'astro-island[component-url*="ChoreManager"][client-render-time]',
      ).waitFor({ state: "attached" });

      await expect(page.getByRole("tab", { name: "What's Next" }))
        .toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("textbox", { name: "Search Board chores" }))
        .toHaveCount(0);
      await expect(page.locator("li").filter({ hasText: futureTitle }))
        .toBeVisible();
      await expect(page.locator("li").filter({ hasText: todayTitle }))
        .toBeVisible();
      await expect(page.locator("li").filter({ hasText: overdueTitle }))
        .toHaveCount(0);
      await expect(
        page.locator("details").filter({ hasText: "Done assigned to you" }),
      )
        .not.toHaveAttribute("open", "");

      await page.getByRole("tab", { name: "Board" }).click();
      await expect(page.getByRole("textbox", { name: "Search Board chores" }))
        .toBeVisible();
      await expect(page.locator("li").filter({ hasText: futureTitle }))
        .toBeVisible();
      await expect(
        page.locator("details").filter({ hasText: "Done household chores" }),
      )
        .not.toHaveAttribute("open", "");

      await page.getByRole("textbox", { name: "Search Board chores" }).fill(
        doneTitle,
      );
      await expect(
        page.locator("details").filter({
          hasText: "Done matching Board search",
        }),
      )
        .toHaveAttribute("open", "");
      await expect(page.locator("li").filter({ hasText: doneTitle }))
        .toBeVisible();

      await page.locator("li").filter({ hasText: doneTitle }).locator(
        "button[aria-label='Mark as undone']",
      ).click();
      await expect(
        page.locator("li").filter({ hasText: doneTitle }).locator(
          "button[aria-label='Mark as done']",
        ),
      ).toBeVisible();
      await page.getByRole("textbox", { name: "Search Board chores" }).fill("");

      await page.getByRole("tab", { name: "Pool" }).click();
      const poolRow = page.locator("li").filter({ hasText: poolTitle });
      await expect(poolRow).toBeVisible();
      await expect(poolRow).toContainText("In Pool for less than a day");
      await expect(page.locator("details").filter({ hasText: "Done in Pool" }))
        .not.toHaveAttribute("open", "");

      const claimResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/chores/${pool.id}`) &&
        response.request().method() === "POST"
      );
      await poolRow.getByRole("button", { name: "Claim" }).click();
      await expect((await claimResponse).status()).toBe(200);
      await expect(poolRow).toHaveCount(0);

      await page.getByRole("tab", { name: "Board" }).click();
      const claimedRow = page.locator("li").filter({ hasText: poolTitle });
      await expect(claimedRow).toBeVisible();
      await expect(claimedRow).not.toContainText("In Pool for");
      const releaseResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/chores/${pool.id}/assignment`) &&
        response.request().method() === "POST"
      );
      await claimedRow.getByRole("button", { name: "Release" }).click();
      await expect((await releaseResponse).status()).toBe(200);

      await page.getByRole("tab", { name: "Pool" }).click();
      await expect(poolRow).toBeVisible();
      await expect(poolRow).toContainText("In Pool for less than a day");

      const donePoolResponse = page.waitForResponse((response) =>
        response.url().includes(`/api/chores/${pool.id}`) &&
        response.request().method() === "PUT"
      );
      await poolRow.getByRole("button", { name: "Mark as done" }).click();
      await expect((await donePoolResponse).status()).toBe(200);
      await expect(poolRow).toBeVisible();
      await expect(poolRow).not.toContainText("In Pool for");
    } finally {
      await cleanupChores(request, baseURL, testId);
    }
  });
});
