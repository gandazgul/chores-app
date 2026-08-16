import "../../../env.d.ts";
import { assertEquals } from "@std/assert";
import type { APIContext } from "astro";
import type { Member, UserPayload } from "../../../types.ts";
import db from "../../../utils/db.ts";
import { GET } from "./index.ts";

const USER: UserPayload = {
  id: "member-api-user-1",
  email: "member1@example.com",
  name: "Member One",
};

const OTHER: UserPayload = {
  id: "member-api-user-2",
  email: "member2@example.com",
  name: "Member Two",
};

function context(fields: Partial<APIContext>): APIContext {
  return fields as unknown as APIContext;
}

function cleanup() {
  db.prepare("DELETE FROM chores").run();
  db.prepare("DELETE FROM users").run();
}

Deno.test({
  name: "members endpoint rejects unauthenticated requests",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const response = await GET(
      context({ locals: { user: null } }),
    ) as Response;

    assertEquals(response.status, 401);
  },
});

Deno.test({
  name: "members endpoint returns stable public member fields only",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    cleanup();
    try {
      db.prepare(`
        INSERT INTO users (id, email, name, picture)
        VALUES (?, ?, ?, ?), (?, ?, ?, ?)
      `).run(
        USER.id,
        USER.email,
        USER.name,
        "https://example.com/member1.png",
        OTHER.id,
        OTHER.email,
        null,
        null,
      );

      const response = await GET(
        context({ locals: { user: USER } }),
      ) as Response;

      assertEquals(response.status, 200);
      const members = await response.json() as Member[];
      assertEquals(members, [
        { id: OTHER.id, name: null, picture: null },
        {
          id: USER.id,
          name: USER.name,
          picture: "https://example.com/member1.png",
        },
      ]);
      assertEquals(
        "email" in (members[0] as unknown as Record<string, unknown>),
        false,
      );
      assertEquals(
        "created_at" in (members[0] as unknown as Record<string, unknown>),
        false,
      );
      assertEquals(
        "updated_at" in (members[0] as unknown as Record<string, unknown>),
        false,
      );
      assertEquals(
        "session" in (members[0] as unknown as Record<string, unknown>),
        false,
      );
      assertEquals(
        "gotify_token" in (members[0] as unknown as Record<string, unknown>),
        false,
      );
    } finally {
      cleanup();
    }
  },
});
