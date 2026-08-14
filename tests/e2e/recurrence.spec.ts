import { expect, test } from "@playwright/test";

interface ChoreResponse {
  id: string;
  title: string;
  done: 0 | 1;
  status: "open" | "completed" | "skipped";
  recurrence: { rrule: string } | string | null;
}

test.describe("Recurrence Tasks", () => {
  const testId = Date.now().toString();
  const recurrences = ["FREQ=DAILY", "FREQ=WEEKLY", "FREQ=MONTHLY"];

  test("can create recurring chores and completing them spawns successors", async ({ page, request }) => {
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
      await page.locator(
        'astro-island[component-url*="ChoreList"][client-render-time]',
      ).waitFor();

      for (const rrule of recurrences) {
        const title = `Recurrence Test ${rrule} ${testId}`;
        const choreLocator = page.locator("li").filter({ hasText: title })
          .first();

        await choreLocator.locator("button[aria-label='Mark as done']").click();

        await expect.poll(async () => {
          const getRes = await request.get("/api/chores");
          const chores = await getRes.json() as ChoreResponse[];
          const matchingChores = chores.filter((chore) =>
            chore.title === title
          );
          const openSuccessors = matchingChores.filter((chore) => {
            const recurrence = chore.recurrence;
            return chore.status === "open" && chore.done === 0 &&
              typeof recurrence === "object" && recurrence?.rrule === rrule;
          });

          return { open: openSuccessors.length };
        }).toEqual({ open: 1 });
      }
    } finally {
      const getRes = await request.get("/api/chores");
      const chores = await getRes.json() as ChoreResponse[];
      for (const chore of chores) {
        if (chore.title.includes(testId)) {
          await request.delete(`/api/chores/${chore.id}`);
        }
      }
    }
  });
});
