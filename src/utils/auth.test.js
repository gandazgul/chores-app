import { createSession, getSession } from "./auth.js";
import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";

/** @typedef {import('./auth.js').UserPayload} UserPayload */

/** @type {UserPayload} */
const MOCK_USER = {
  id: "test-123",
  email: "test@example.com",
  name: "Test User",
};

Deno.test("auth utilities - Session encoding and decoding", async () => {
  // Set required env vars for tests
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");

  const token = await createSession(MOCK_USER);
  assertNotEquals(token, "");

  const decoded = await getSession(token);
  assertEquals(decoded?.id, MOCK_USER.id);
  assertEquals(decoded?.email, MOCK_USER.email);
  assertEquals(decoded?.name, MOCK_USER.name);

  // Cleanup
  Deno.env.delete("SESSION_SECRET");
});

Deno.test("auth utilities - Missing SESSION_SECRET throws error", async () => {
  Deno.env.delete("SESSION_SECRET");

  await assertRejects(
    async () => {
      await createSession(MOCK_USER);
    },
    Error,
    "SESSION_SECRET environment variable is missing",
  );
});

Deno.test("auth utilities - Invalid token returns null", async () => {
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");

  const decoded = await getSession("invalid.token.here");
  assertEquals(decoded, null);

  Deno.env.delete("SESSION_SECRET");
});
