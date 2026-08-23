/// <reference types="@cloudflare/vitest-plugin/types" />

import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../worker/index";

const session = {
  sessionId: "horizons-test-session",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

beforeAll(async () => {
  await env.HORIZONS_DB.prepare(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      horizon TEXT NOT NULL,
      period_key TEXT NOT NULL,
      time_zone TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await env.HORIZONS_DB.prepare(
    "CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON tasks (user_id, created_at, id)",
  ).run();
});

beforeEach(async () => {
  await env.HORIZONS_DB.prepare("DELETE FROM tasks").run();
});

describe("Horizons task API", () => {
  it("keeps tasks isolated by authenticated user", async () => {
    const ownerId = `owner-${crypto.randomUUID()}`;
    const otherUserId = `other-${crypto.randomUUID()}`;

    const created = await request(ownerId, "/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text: "Private task",
        horizon: "today",
        timeZone: "UTC",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody: unknown = await created.json();
    const createdId = readTaskId(createdBody);

    const otherTasks = await request(otherUserId, "/api/tasks");
    expect(otherTasks.status).toBe(200);
    expect(await otherTasks.json()).toEqual({ tasks: [] });

    const otherDelete = await request(otherUserId, `/api/tasks/${createdId}`, {
      method: "DELETE",
    });
    expect(otherDelete.status).toBe(404);

    const ownerTasks = await request(ownerId, "/api/tasks");
    expect(ownerTasks.status).toBe(200);
    expect(await ownerTasks.json()).toMatchObject({
      tasks: [{ text: "Private task", horizon: "today", timeZone: "UTC" }],
    });
  });

  it("removes stale tasks on the server", async () => {
    const userId = `stale-${crypto.randomUUID()}`;
    const created = await request(userId, "/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text: "Stale task",
        horizon: "today",
        timeZone: "UTC",
      }),
    });
    const createdBody: unknown = await created.json();
    const createdId = readTaskId(createdBody);

    await env.HORIZONS_DB.prepare(
      "UPDATE tasks SET period_key = ? WHERE id = ?",
    ).bind("2000-01-01", createdId).run();

    const response = await request(userId, "/api/tasks");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tasks: [] });

    const remaining = await env.HORIZONS_DB.prepare(
      "SELECT COUNT(*) AS count FROM tasks WHERE id = ?",
    ).bind(createdId).first<{ count: number }>();
    expect(remaining?.count).toBe(0);
  });

  it("forwards sign-out through the auth service", async () => {
    const response = await request("sign-out-user", "/api/auth/sign-out", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cookie: "session=sign-out-user" });
    expect(response.headers.get("set-cookie")).toContain("session=; Max-Age=0");
  });

  it("protects the sign-out boundary", async () => {
    const rejected = await request(null, "/api/auth/sign-out", {
      method: "POST",
      headers: { Origin: "https://malicious.test" },
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("cache-control")).toBe("no-store");
    expect(rejected.headers.get("x-content-type-options")).toBe("nosniff");

    const wrongMethod = await request(null, "/api/auth/sign-out");
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const unavailable = await request(
        null,
        "/api/auth/sign-out",
        { method: "POST" },
        async () => { throw new Error("service unavailable"); },
      );
      expect(unavailable.status).toBe(503);
      expect(await unavailable.json()).toMatchObject({
        error: { code: "auth_unavailable" },
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("rejects anonymous and invalid task requests", async () => {
    const anonymous = await request(null, "/api/tasks");
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("cache-control")).toBe("no-store");
    expect(anonymous.headers.get("x-content-type-options")).toBe("nosniff");

    const invalid = await request("validation-user", "/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        text: "Task",
        horizon: "today",
        timeZone: "Not/AZone",
      }),
    });
    expect(invalid.status).toBe(400);
  });
});

function readTaskId(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.task) || typeof value.task.id !== "string") {
    throw new Error("Expected a task response");
  }

  return value.task.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(
  userId: string | null,
  path: string,
  init: RequestInit = {},
  signOut: (cookie: string) => Promise<Response> = mockSignOut,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Origin")) {
    headers.set("Origin", "https://horizons.test");
  }
  if (userId !== null) {
    headers.set("Cookie", `session=${userId}`);
  }

  const request = new Request(`https://horizons.test${path}`, {
    ...init,
    headers,
  });
  const context = createExecutionContext();
  const testEnv = {
    ...env,
    AUTH_SERVICE: {
      getSession: async (cookie: string) => cookie.startsWith("session=")
        ? {
            ...session,
            userId: cookie.slice("session=".length),
          }
        : null,
      signOut,
    },
  };
  const response = await worker.fetch(request, testEnv, context);
  await waitOnExecutionContext(context);
  return response;
}

async function mockSignOut(cookie: string): Promise<Response> {
  return Response.json({ cookie }, {
    headers: { "Set-Cookie": "session=; Max-Age=0; Path=/" },
  });
}
