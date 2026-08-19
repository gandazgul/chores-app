import { type APIRequestContext, expect, test } from "@playwright/test";
import { originHeaders } from "./origin.ts";

interface ChoreResponse {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  done: 0 | 1;
  remind_until_done: 0 | 1;
}

async function cleanupChores(
  request: APIRequestContext,
  baseURL: string | undefined,
  testId: string,
) {
  const getRes = await request.get("/api/chores");
  expect(getRes.status()).toBe(200);
  const chores = await getRes.json() as ChoreResponse[];
  for (const chore of chores) {
    if (chore.title.includes(testId)) {
      await request.delete(`/api/chores/${chore.id}`, {
        headers: originHeaders(baseURL),
      });
    }
  }
}

test.describe("Chore management browser flows", () => {
  test("user can create with due time, assign, edit, and delete a chore", async ({ baseURL, page, request }) => {
    const testId = Date.now().toString();
    const title = `Management Flow ${testId}`;
    const editedTitle = `Management Flow Edited ${testId}`;

    await page.goto("/");
    await page.locator(
      'astro-island[component-url*="ChoreManager"][client-render-time]',
    ).waitFor({ state: "attached" });

    try {
      await page.getByRole("button", { name: "New Chore" }).click();
      await expect(page.getByRole("dialog", { name: "Add New Chore" }))
        .toBeVisible();
      await page.getByLabel("Title *").fill(title);
      await page.getByLabel("Description (optional)").fill(
        "Created from the management e2e flow",
      );
      await page.getByLabel("Due date and time").fill("2030-03-04T05:06");
      await page.getByLabel("Assignment").selectOption("");
      await expect(page.getByLabel("Allow push notifications for this chore"))
        .toBeChecked();
      await page.getByLabel("Allow push notifications for this chore")
        .uncheck();
      await page.getByRole("button", { name: "Save Chore" }).click();
      await page.getByRole("tab", { name: "Pool" }).click();

      const choreItem = page.locator("li").filter({ hasText: title }).first();
      await expect(choreItem).toBeVisible();
      await expect(choreItem).toContainText("Due:");
      await expect(choreItem).toContainText("Pool");

      await choreItem.getByRole("button", { name: "Claim" }).click();
      await page.getByRole("tab", { name: "Board" }).click();
      const claimedItem = page.locator("li").filter({ hasText: title }).first();
      await expect(claimedItem).toContainText("Assigned:");

      await claimedItem.getByRole("button", { name: "Release" }).click();
      await expect(claimedItem).toContainText("Pool");

      await claimedItem.getByLabel(`Assign ${title}`).selectOption({
        index: 1,
      });
      await expect(claimedItem).toContainText("Assigned:");

      await claimedItem.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByRole("dialog", { name: "Edit Chore" }))
        .toBeVisible();
      await page.getByLabel("Title *").fill(editedTitle);
      await page.getByLabel("Description (optional)").fill(
        "Edited from the management e2e flow",
      );
      await page.getByLabel("Due date and time").fill("2030-03-05T07:08");
      await page.getByLabel("Assignment").selectOption("");
      await expect(page.getByLabel("Allow push notifications for this chore"))
        .not.toBeChecked();
      await page.getByLabel("Allow push notifications for this chore").check();
      await page.getByRole("button", { name: "Save Chore" }).click();

      await page.getByRole("tab", { name: "Pool" }).click();
      const editedItem = page.locator("li").filter({ hasText: editedTitle })
        .first();
      await expect(editedItem).toBeVisible();
      await expect(editedItem).toContainText(
        "Edited from the management e2e flow",
      );
      await expect(editedItem).toContainText("Pool");

      const listRes = await request.get("/api/chores");
      expect(listRes.status()).toBe(200);
      const chores = await listRes.json() as ChoreResponse[];
      const editedChore = chores.find((chore) => chore.title === editedTitle);
      expect(editedChore).toBeDefined();
      expect(editedChore?.description).toBe(
        "Edited from the management e2e flow",
      );
      expect(editedChore?.assignee_id).toBeNull();
      expect(editedChore?.due_date).toBeTruthy();
      expect(editedChore?.remind_until_done).toBe(1);

      await editedItem.getByRole("button", { name: "Edit" }).click();
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Confirm delete" }).click();
      await expect(page.locator("li").filter({ hasText: editedTitle }))
        .toHaveCount(0);

      await expect.poll(async () => {
        const afterDeleteRes = await request.get("/api/chores");
        const afterDelete = await afterDeleteRes.json() as ChoreResponse[];
        return afterDelete.some((chore) => chore.title === editedTitle);
      }).toBe(false);
    } finally {
      await cleanupChores(request, baseURL, testId);
    }
  });
});
