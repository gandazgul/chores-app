import {
  assertEquals,
  assertFalse,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import type { UserPayload } from "../types.ts";
import { createSession, getSession, isEmailAllowed } from "./auth.ts";

const MOCK_USER: UserPayload = {
  id: "test-123",
  email: "test@example.com",
  name: "Test User",
};

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(name);
    } else {
      Deno.env.set(name, value);
    }
  }
}

Deno.test("auth utilities - Session encoding and decoding", async () => {
  const snapshot = {
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");
  Deno.env.set("ALLOWED_EMAILS", "test@example.com");

  try {
    const token = await createSession(MOCK_USER);
    assertNotEquals(token, "");

    const decoded = await getSession(token);
    assertEquals(decoded?.id, MOCK_USER.id);
    assertEquals(decoded?.email, MOCK_USER.email);
    assertEquals(decoded?.name, MOCK_USER.name);
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("auth utilities - Missing SESSION_SECRET throws error", async () => {
  const snapshot = { SESSION_SECRET: Deno.env.get("SESSION_SECRET") };
  Deno.env.delete("SESSION_SECRET");

  try {
    await assertRejects(
      async () => {
        await createSession(MOCK_USER);
      },
      Error,
      "SESSION_SECRET environment variable is missing",
    );
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("auth utilities - Invalid token returns null", async () => {
  const snapshot = { SESSION_SECRET: Deno.env.get("SESSION_SECRET") };
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");

  try {
    const decoded = await getSession("invalid.token.here");
    assertEquals(decoded, null);
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("auth utilities - allowlist matches case-insensitive trimmed entries", () => {
  const snapshot = { ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS") };
  Deno.env.set(
    "ALLOWED_EMAILS",
    " first@example.com,  Household.Member@Example.COM  ,,second@example.com ",
  );

  try {
    assertEquals(isEmailAllowed(" household.member@example.com "), true);
    assertEquals(isEmailAllowed("HOUSEHOLD.MEMBER@EXAMPLE.COM"), true);
    assertEquals(isEmailAllowed("second@example.com"), true);
    assertFalse(isEmailAllowed("outside@example.com"));
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("auth utilities - missing and empty allowlists deny all email", () => {
  const snapshot = { ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS") };

  try {
    Deno.env.delete("ALLOWED_EMAILS");
    assertFalse(isEmailAllowed("test@example.com"));

    Deno.env.set("ALLOWED_EMAILS", "");
    assertFalse(isEmailAllowed("test@example.com"));

    Deno.env.set("ALLOWED_EMAILS", " , , ");
    assertFalse(isEmailAllowed("test@example.com"));
  } finally {
    restoreEnv(snapshot);
  }
});

Deno.test("auth utilities - removed allowlist email invalidates an existing Session", async () => {
  const snapshot = {
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("SESSION_SECRET", "super-secret-key-for-tests-12345");
  Deno.env.set("ALLOWED_EMAILS", MOCK_USER.email);

  try {
    const token = await createSession(MOCK_USER);
    assertEquals((await getSession(token))?.id, MOCK_USER.id);

    Deno.env.set("ALLOWED_EMAILS", "other@example.com");
    assertEquals(await getSession(token), null);
  } finally {
    restoreEnv(snapshot);
  }
});
