import { expect, test } from "@playwright/test";

test.describe("Core Journey", () => {
  // Use a common timestamp to make titles unique per test run
  const testId = Date.now().toString();

  test("User can view chores, create a new one, and mark it as done", async ({ page, request }) => {
    // Navigate to the app (assuming mock auth bypasses login automatically if ENABLE_AUTH=false)
    await page.goto("/");

    // We verify we are on the home page and not redirected to /login
    await expect(page).toHaveURL("/");

    // Optionally check if a "chores" related heading is present
    // Let's create a chore via the API first if there's no UI yet,
    // or wait, the instructions say "via the API (or initial UI if available)".
    // Currently, there is no UI for creating a chore in Phase 3,
    // it will be built in Phase 4. We can test the API using playwright's request fixture.

    const newChoreTitle = `Test Chore E2E ${testId}`;

    const createRes = await request.post("/api/chores", {
      data: {
        title: newChoreTitle,
        description: "E2E description",
        rrule: "FREQ=DAILY",
      },
    });

    expect(createRes.status()).toBe(201);
    const createdChore = await createRes.json();
    expect(createdChore.title).toBe(newChoreTitle);

    const choreId = createdChore.id;

    // Verify it exists in GET /api/chores
    const getRes = await request.get("/api/chores");
    expect(getRes.status()).toBe(200);
    const choresList = await getRes.json();

    // Ensure our newly created chore is in the list
    const foundChore = choresList.find((/** @type {any} */ c) =>
      c.id === choreId
    );
    expect(foundChore).toBeDefined();
    expect(foundChore.title).toBe(newChoreTitle);

    // Mark as completed
    const completeRes = await request.put(`/api/chores/${choreId}`, {
      data: {
        done: true,
      },
    });

    expect(completeRes.status()).toBe(200);
    const updatedChore = await completeRes.json();
    // Since it's DAILY, marking it done should advance the due date and set done back to 0
    expect(updatedChore.done).toBe(0);

    // Delete the chore so it doesn't clutter
    const deleteRes = await request.delete(`/api/chores/${choreId}`);
    expect(deleteRes.status()).toBe(204);
  });
});
