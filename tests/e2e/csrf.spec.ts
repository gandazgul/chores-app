import { expect, test } from "@playwright/test";
import { invalidOriginCases, originHeaders } from "./origin.ts";

interface ChoreResponse {
  id: string;
  title: string;
  done: 0 | 1;
}

function headersFor(origin?: string): Record<string, string> | undefined {
  return origin === undefined ? undefined : { Origin: origin };
}

interface ChoreReader {
  get(path: string): Promise<{
    status(): number;
    json(): Promise<unknown>;
  }>;
}

async function choresWithTitle(
  request: ChoreReader,
  title: string,
): Promise<ChoreResponse[]> {
  const response = await request.get("/api/chores");
  expect(response.status()).toBe(200);
  const chores = await response.json() as ChoreResponse[];
  return chores.filter((chore) => chore.title === title);
}

test.describe("CSRF boundary", () => {
  const testId = Date.now().toString();

  test("rejects every unsafe method without exact same-origin evidence", async ({ baseURL, request }) => {
    const invalidCases = invalidOriginCases(baseURL);
    const validHeaders = originHeaders(baseURL);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      for (const originCase of invalidCases) {
        const response = await request.fetch("/__csrf_probe__", {
          method,
          data: {},
          headers: headersFor(originCase.origin),
        });
        expect(
          response.status(),
          `${method} must reject ${originCase.name}`,
        ).toBe(403);
      }

      const validResponse = await request.fetch("/__csrf_probe__", {
        method,
        data: {},
        headers: validHeaders,
      });
      expect(validResponse.status(), `${method} exact origin must pass gate`)
        .not.toBe(403);
    }
  });

  test("rejects form chore creation without exact same-origin evidence and keeps data unchanged", async ({ baseURL, request }) => {
    const invalidCases = invalidOriginCases(baseURL);
    const title = `CSRF form reject ${testId}`;

    for (const originCase of invalidCases) {
      const response = await request.post("/api/chores", {
        form: {
          title,
          description: originCase.name,
        },
        headers: headersFor(originCase.origin),
      });
      expect(response.status(), `form create must reject ${originCase.name}`)
        .toBe(403);
      expect(await choresWithTitle(request, title)).toHaveLength(0);
    }
  });

  test("allows exact same-origin form chore creation", async ({ baseURL, request }) => {
    const title = `CSRF form allow ${testId}`;

    try {
      const response = await request.post("/api/chores", {
        form: { title, description: "same-origin form" },
        headers: originHeaders(baseURL),
      });
      expect(response.status()).not.toBe(403);
      await expect.poll(async () =>
        (await choresWithTitle(request, title)).length
      )
        .toBe(1);
    } finally {
      const chores = await choresWithTitle(request, title);
      for (const chore of chores) {
        await request.delete(`/api/chores/${chore.id}`, {
          headers: originHeaders(baseURL),
        });
      }
    }
  });

  test("rejects JSON chore update and delete without exact same-origin evidence and keeps data unchanged", async ({ baseURL, request }) => {
    const title = `CSRF JSON reject ${testId}`;
    const headers = originHeaders(baseURL);
    const createResponse = await request.post("/api/chores", {
      data: { title, description: "json setup" },
      headers,
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json() as ChoreResponse;

    try {
      for (const originCase of invalidOriginCases(baseURL)) {
        const updateResponse = await request.put(`/api/chores/${created.id}`, {
          data: { done: true },
          headers: headersFor(originCase.origin),
        });
        expect(
          updateResponse.status(),
          `JSON update must reject ${originCase.name}`,
        ).toBe(403);

        const [afterUpdate] = await choresWithTitle(request, title);
        expect(afterUpdate.done).toBe(0);

        const deleteResponse = await request.delete(
          `/api/chores/${created.id}`,
          {
            headers: headersFor(originCase.origin),
          },
        );
        expect(
          deleteResponse.status(),
          `JSON delete must reject ${originCase.name}`,
        ).toBe(403);

        expect(await choresWithTitle(request, title)).toHaveLength(1);
      }
    } finally {
      await request.delete(`/api/chores/${created.id}`, { headers });
    }
  });

  test("allows exact same-origin JSON update and delete", async ({ baseURL, request }) => {
    const title = `CSRF JSON allow ${testId}`;
    const headers = originHeaders(baseURL);
    const createResponse = await request.post("/api/chores", {
      data: { title, description: "json setup" },
      headers,
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json() as ChoreResponse;

    const updateResponse = await request.put(`/api/chores/${created.id}`, {
      data: { done: true },
      headers,
    });
    expect(updateResponse.status()).toBe(200);
    const updated = await updateResponse.json() as ChoreResponse;
    expect(updated.done).toBe(1);

    const deleteResponse = await request.delete(`/api/chores/${created.id}`, {
      headers,
    });
    expect(deleteResponse.status()).toBe(204);
    expect(await choresWithTitle(request, title)).toHaveLength(0);
  });
});
