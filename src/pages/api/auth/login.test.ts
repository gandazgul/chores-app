import "../../../env.d.ts";
import { assertEquals, assertExists, assertRejects } from "@std/assert";
import type { APIContext } from "astro";
import type { UserPayload } from "../../../types.ts";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  updated_at: string | null;
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      Deno.env.delete(name);
    } else {
      Deno.env.set(name, value);
    }
  }
}

function context(fields: Partial<APIContext>): APIContext {
  return fields as unknown as APIContext;
}

Deno.test("createAuthorizedSession creates an allowed User before returning a Session", async () => {
  const snapshot = {
    DB_ENV: Deno.env.get("DB_ENV"),
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("DB_ENV", "test");
  Deno.env.set("SESSION_SECRET", "login-test-secret-123456789");
  Deno.env.set("ALLOWED_EMAILS", " allowed@example.com ");

  const { createAuthorizedSession } = await import("./login.ts");
  const { getSession } = await import("../../../utils/auth.ts");
  const db = (await import("../../../utils/db.ts")).default;
  const user: UserPayload = {
    id: "login-allowed-user",
    email: "allowed@example.com",
    name: "Allowed User",
  };

  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    const token = await createAuthorizedSession(user);

    const row = db.prepare(
      "SELECT id, email, name, updated_at FROM users WHERE id = ?",
    ).get(user.id) as UserRow | undefined;
    assertExists(row);
    assertEquals(row.email, user.email);
    assertEquals(row.name, user.name);
    assertEquals((await getSession(token))?.id, user.id);
  } finally {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    restoreEnv(snapshot);
  }
});

Deno.test("createAuthorizedSession updates an allowed User on repeat login", async () => {
  const snapshot = {
    DB_ENV: Deno.env.get("DB_ENV"),
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("DB_ENV", "test");
  Deno.env.set("SESSION_SECRET", "login-test-secret-123456789");
  Deno.env.set(
    "ALLOWED_EMAILS",
    "allowed@example.com, changed@example.com",
  );

  const { createAuthorizedSession } = await import("./login.ts");
  const db = (await import("../../../utils/db.ts")).default;
  const user: UserPayload = {
    id: "login-repeat-user",
    email: "allowed@example.com",
    name: "Allowed User",
  };

  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    await createAuthorizedSession(user);
    db.prepare("UPDATE users SET updated_at = ? WHERE id = ?").run(
      "2000-01-01 00:00:00",
      user.id,
    );

    await createAuthorizedSession({
      ...user,
      email: "changed@example.com",
      name: "Changed User",
    });

    const row = db.prepare(
      "SELECT id, email, name, updated_at FROM users WHERE id = ?",
    ).get(user.id) as UserRow | undefined;
    assertExists(row);
    assertEquals(row.email, "changed@example.com");
    assertEquals(row.name, "Changed User");
    assertEquals(row.updated_at !== "2000-01-01 00:00:00", true);
  } finally {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    restoreEnv(snapshot);
  }
});

Deno.test("createAuthorizedSession rejects disallowed Users without writing a row", async () => {
  const snapshot = {
    DB_ENV: Deno.env.get("DB_ENV"),
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("DB_ENV", "test");
  Deno.env.set("SESSION_SECRET", "login-test-secret-123456789");
  Deno.env.set("ALLOWED_EMAILS", "allowed@example.com");

  const { createAuthorizedSession } = await import("./login.ts");
  const db = (await import("../../../utils/db.ts")).default;
  const user: UserPayload = {
    id: "login-denied-user",
    email: "denied@example.com",
    name: "Denied User",
  };

  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    await assertRejects(
      () => createAuthorizedSession(user),
      Error,
      "User email is not allowed",
    );
    assertEquals(
      db.prepare("SELECT id FROM users WHERE id = ?").get(user.id),
      undefined,
    );
  } finally {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    restoreEnv(snapshot);
  }
});

Deno.test("createAuthorizedSession fails closed when ALLOWED_EMAILS has no entries", async () => {
  const snapshot = {
    DB_ENV: Deno.env.get("DB_ENV"),
    SESSION_SECRET: Deno.env.get("SESSION_SECRET"),
    ALLOWED_EMAILS: Deno.env.get("ALLOWED_EMAILS"),
  };
  Deno.env.set("DB_ENV", "test");
  Deno.env.set("SESSION_SECRET", "login-test-secret-123456789");
  Deno.env.set("ALLOWED_EMAILS", " , , ");

  const { createAuthorizedSession } = await import("./login.ts");
  const db = (await import("../../../utils/db.ts")).default;
  const user: UserPayload = {
    id: "login-fail-closed-user",
    email: "allowed@example.com",
    name: "Fail Closed User",
  };

  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    await assertRejects(() => createAuthorizedSession(user));
    assertEquals(
      db.prepare("SELECT id FROM users WHERE id = ?").get(user.id),
      undefined,
    );
  } finally {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    restoreEnv(snapshot);
  }
});

Deno.test("login route returns 400 when the credential is missing", async () => {
  const { POST } = await import("./login.ts");

  const response = await POST(
    context({
      request: new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    }),
  ) as Response;

  assertEquals(response.status, 400);
  assertEquals(response.headers.get("set-cookie"), null);
});
