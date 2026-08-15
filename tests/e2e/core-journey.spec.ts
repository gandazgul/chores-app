import { expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

interface ChoreResponse {
  id: string;
  title: string;
  done: 0 | 1;
  recurrence: { rrule: string } | string | null;
}

test.describe("Core Journey", () => {
  const testId = Date.now().toString();

  test("User can view chores, create a new one, and mark it as done", async ({ baseURL, page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await page.locator(
      'astro-island[component-url*="ChoreModal"][client-render-time]',
    ).waitFor();

    const newChoreTitle = `Test Chore E2E ${testId}`;

    await page.getByRole("button", { name: "New Chore" }).click();
    await page.getByLabel("Title *").fill(newChoreTitle);
    await page.getByLabel("Description (optional)").fill("E2E description");
    await page.getByLabel("Recurrence").selectOption("FREQ=DAILY");
    await page.getByRole("button", { name: "Save Chore" }).click();
    await page.waitForURL("/");
    await expect(page.locator("li").filter({ hasText: newChoreTitle }))
      .toBeVisible();

    const getRes = await request.get("/api/chores");
    expect(getRes.status()).toBe(200);
    const choresList = await getRes.json() as ChoreResponse[];

    const createdChore = choresList.find((chore) =>
      chore.title === newChoreTitle
    );
    expect(createdChore).toBeDefined();
    expect(createdChore?.recurrence).toEqual({ rrule: "FREQ=DAILY" });

    const choreId = createdChore?.id;
    if (!choreId) {
      throw new Error("Created Chore did not include an id");
    }

    try {
      await page.locator("li").filter({ hasText: newChoreTitle }).locator(
        "button[aria-label='Mark as done']",
      ).click();

      await expect(
        page.locator("li").filter({ hasText: newChoreTitle }).locator(
          "button[aria-label='Mark as undone']",
        ),
      ).toBeVisible();

      await expect.poll(async () => {
        const afterCompleteRes = await request.get("/api/chores");
        const choresAfterComplete = await afterCompleteRes
          .json() as ChoreResponse[];
        const spawnedChore = choresAfterComplete.find((chore) =>
          chore.title === newChoreTitle && chore.id !== choreId
        );
        return spawnedChore?.done;
      }).toBe(0);
    } finally {
      const cleanupRes = await request.get("/api/chores");
      const chores = await cleanupRes.json() as ChoreResponse[];
      for (const chore of chores) {
        if (chore.title.includes(testId)) {
          await request.delete(`/api/chores/${chore.id}`, {
            headers: originHeaders(baseURL),
          });
        }
      }
    }
  });
});
