import { expect, test } from "@playwright/test";

interface ChoreResponse {
  id: string;
  title: string;
  done: 0 | 1;
  recurrence: { rrule: string } | string | null;
}

test.describe("Core Journey", () => {
  const testId = Date.now().toString();

  test("User can view chores, create a new one, and mark it as done", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");

    const newChoreTitle = `Test Chore E2E ${testId}`;

    const createRes = await request.post("/api/chores", {
      data: {
        title: newChoreTitle,
        description: "E2E description",
        rrule: "FREQ=DAILY",
      },
    });

    expect(createRes.status()).toBe(201);
    const createdChore = await createRes.json() as ChoreResponse;
    expect(createdChore.title).toBe(newChoreTitle);

    const choreId = createdChore.id;

    try {
      const getRes = await request.get("/api/chores");
      expect(getRes.status()).toBe(200);
      const choresList = await getRes.json() as ChoreResponse[];

      const foundChore = choresList.find((chore) => chore.id === choreId);
      expect(foundChore).toBeDefined();
      expect(foundChore?.title).toBe(newChoreTitle);

      const completeRes = await request.put(`/api/chores/${choreId}`, {
        data: {
          done: true,
        },
      });

      expect(completeRes.status()).toBe(200);
      const updatedChore = await completeRes.json() as ChoreResponse;
      expect(updatedChore.done).toBe(1);
      expect(updatedChore.recurrence).toEqual({ rrule: "FREQ=DAILY" });

      const afterCompleteRes = await request.get("/api/chores");
      const choresAfterComplete = await afterCompleteRes
        .json() as ChoreResponse[];
      const spawnedChore = choresAfterComplete.find((chore) =>
        chore.title === newChoreTitle && chore.id !== choreId
      );
      expect(spawnedChore).toBeDefined();
      expect(spawnedChore?.done).toBe(0);
    } finally {
      const cleanupRes = await request.get("/api/chores");
      const chores = await cleanupRes.json() as ChoreResponse[];
      for (const chore of chores) {
        if (chore.title.includes(testId)) {
          await request.delete(`/api/chores/${chore.id}`);
        }
      }
    }
  });
});
