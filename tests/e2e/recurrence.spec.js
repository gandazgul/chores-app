import { expect, test } from "@playwright/test";

test.describe("Recurrence Tasks", () => {
  const testId = Date.now().toString();
  const recurrences = ["FREQ=DAILY", "FREQ=WEEKLY", "FREQ=MONTHLY"];

  test("can create, mark done, and mark not done for all recurrences", async ({ page, request }) => {
    // Create tasks for each recurrence
    for (const rrule of recurrences) {
      const title = `Recurrence Test ${rrule} ${testId}`;
      const createRes = await request.post("/api/chores", {
        data: {
          title,
          description: "Test description",
          rrule,
        },
      });
      expect(createRes.status()).toBe(201);
    }

    try {
      await page.goto("/");
      
      // Mark each task done, then not done
      for (const rrule of recurrences) {
        const title = `Recurrence Test ${rrule} ${testId}`;
        const choreLocator = page.locator("li").filter({ hasText: title }).first();
        
        // Find the toggle button
        const toggleButton = choreLocator.locator("button[aria-label='Mark as done']");
        
        // Click to mark as done
        await toggleButton.click();
        
        // Wait for it to become 'Mark as undone'
        const undoneButton = choreLocator.locator("button[aria-label='Mark as undone']");
        await expect(undoneButton).toBeVisible();
        
        // Click to mark as not done
        await undoneButton.click();
        
        // Wait for it to become 'Mark as done' again
        await expect(toggleButton).toBeVisible();
      }
    } finally {
      // Clean up all tasks containing testId in title
      const getRes = await request.get("/api/chores");
      const chores = await getRes.json();
      for (const chore of chores) {
        if (chore.title.includes(testId)) {
          await request.delete(`/api/chores/${chore.id}`);
        }
      }
    }
  });
});
