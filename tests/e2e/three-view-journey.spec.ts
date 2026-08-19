import { type APIRequestContext, expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

interface ChoreResponse {
  id: string;
  title: string;
  assignee_id: string | null;
  status: "open" | "completed" | "skipped";
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
  test("What's Next, Board, Pool, search, Done, and reopen work together", async ({ baseURL, page, request }) => {
    const testId = Date.now().toString();
    const overdueTitle = `Three View Overdue ${testId}`;
    const todayTitle = `Three View Today ${testId}`;
    const futureTitle = `Three View Future ${testId}`;
    const poolTitle = `Three View Pool ${testId}`;
    const doneTitle = `Three View Done Search ${testId}`;

    try {
      await createChore(request, baseURL, {
        title: overdueTitle,
        dueDate: "2000-01-01T12:00:00.000Z",
      });
      await createChore(request, baseURL, {
        title: todayTitle,
        dueDate: "2099-01-01T13:00:00.000Z",
      });
      await createChore(request, baseURL, {
        title: futureTitle,
        dueDate: "2099-01-01T12:00:00.000Z",
      });
      await createChore(request, baseURL, {
        title: poolTitle,
        assigneeId: null,
        dueDate: "2099-01-02T12:00:00.000Z",
      });
      const done = await createChore(request, baseURL, {
        title: doneTitle,
        dueDate: "2099-01-03T12:00:00.000Z",
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

      await page.getByRole("tab", { name: "Pool" }).click();
      await expect(page.locator("li").filter({ hasText: poolTitle }))
        .toBeVisible();
      await expect(page.locator("details").filter({ hasText: "Done in Pool" }))
        .not.toHaveAttribute("open", "");
    } finally {
      await cleanupChores(request, baseURL, testId);
    }
  });
});
