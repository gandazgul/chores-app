import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import type { UserPayload } from "../types.ts";
import { createSession, getSession } from "./auth.ts";

const MOCK_USER: UserPayload = {
  id: "test-123",
  email: "test@example.com",
  name: "Test User",
};

Deno.test("auth utilities - Session encoding and decoding", async () => {
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");

  try {
    const token = await createSession(MOCK_USER);
    assertNotEquals(token, "");

    const decoded = await getSession(token);
    assertEquals(decoded?.id, MOCK_USER.id);
    assertEquals(decoded?.email, MOCK_USER.email);
    assertEquals(decoded?.name, MOCK_USER.name);
  } finally {
    Deno.env.delete("SESSION_SECRET");
  }
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

  try {
    const decoded = await getSession("invalid.token.here");
    assertEquals(decoded, null);
  } finally {
    Deno.env.delete("SESSION_SECRET");
  }
});
