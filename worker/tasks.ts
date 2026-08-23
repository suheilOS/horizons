import type { Context } from "hono";
import { Hono } from "hono";
import { getPeriodKey, isTaskCurrent } from "../shared/task-periods";
import {
  isTaskHorizon,
  isValidTimeZone,
  type Task,
  type TaskHorizon,
} from "../shared/task";
import { requireAuth, type AppEnv } from "./auth";
import { requireSameOrigin } from "./csrf";

const MAX_CREATE_BODY_BYTES = 8 * 1024;
const TASK_COLUMNS = `
  id, user_id, text, horizon, period_key, time_zone, created_at, updated_at
`;

export const taskRoutes = new Hono<AppEnv>();

taskRoutes.use("*", requireAuth);
taskRoutes.use("*", requireSameOrigin);

taskRoutes.get("/tasks", async (context) => {
  const userId = context.get("userId");
  const rows = await context.env.HORIZONS_DB.prepare(`
    SELECT ${TASK_COLUMNS}
    FROM tasks
    WHERE user_id = ?
    ORDER BY created_at ASC, id ASC
  `).bind(userId).all<TaskRow>();

  const currentRows: TaskRow[] = [];
  const staleRows: TaskRow[] = [];
  for (const row of rows.results) {
    (isCurrentRow(row) ? currentRows : staleRows).push(row);
  }

  if (staleRows.length > 0) {
    await context.env.HORIZONS_DB.batch(
      staleRows.map((row) => context.env.HORIZONS_DB.prepare(
        "DELETE FROM tasks WHERE id = ? AND user_id = ?",
      ).bind(row.id, userId)),
    );
  }

  return context.json({ tasks: currentRows.map(toTask) });
});

taskRoutes.post("/tasks", async (context) => {
  const input = await readCreateInput(context);
  if (input === null) {
    return apiError(context, "bad_request", "Enter a task and valid horizon.", 400);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const id = crypto.randomUUID();
  const periodKey = getPeriodKey(input.horizon, now, input.timeZone);

  await context.env.HORIZONS_DB.prepare(`
    INSERT INTO tasks (
      id, user_id, text, horizon, period_key, time_zone, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    context.get("userId"),
    input.text,
    input.horizon,
    periodKey,
    input.timeZone,
    nowIso,
    nowIso,
  ).run();

  const task = await findTask(context.env.HORIZONS_DB, context.get("userId"), id);
  return task === null
    ? apiError(context, "internal_error", "The task could not be created.", 500)
    : context.json({ task: toTask(task) }, 201);
});

taskRoutes.delete("/tasks/:id", async (context) => {
  const result = await context.env.HORIZONS_DB.prepare(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
  ).bind(context.req.param("id"), context.get("userId")).run();

  return result.meta.changes === 1
    ? context.json({ ok: true })
    : apiError(context, "not_found", "The task could not be found.", 404);
});

async function readCreateInput(context: Context<AppEnv>): Promise<CreateTaskInput | null> {
  const body = await readJson(context);
  if (!isRecord(body)) {
    return null;
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const horizon = body.horizon;
  const timeZone = body.timeZone;

  if (
    text.length === 0 ||
    text.length > 500 ||
    !isTaskHorizon(horizon) ||
    !isValidTimeZone(timeZone)
  ) {
    return null;
  }

  return { text, horizon, timeZone };
}

async function readJson(context: Context<AppEnv>): Promise<unknown> {
  const contentLength = context.req.header("Content-Length");
  if (contentLength !== undefined && Number(contentLength) > MAX_CREATE_BODY_BYTES) {
    return null;
  }

  const body = context.req.raw.body;
  if (body === null) {
    return null;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_CREATE_BODY_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }

    const payload = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return JSON.parse(new TextDecoder().decode(payload));
  } catch {
    return null;
  }
}

async function findTask(
  db: D1Database,
  userId: string,
  id: string,
): Promise<TaskRow | null> {
  return db.prepare(`
    SELECT ${TASK_COLUMNS}
    FROM tasks
    WHERE id = ? AND user_id = ?
  `).bind(id, userId).first<TaskRow>();
}

function isCurrentRow(row: TaskRow): boolean {
  try {
    return isTaskCurrent(toTask(row));
  } catch {
    return false;
  }
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    horizon: row.horizon,
    periodKey: row.period_key,
    timeZone: row.time_zone,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiError(
  context: Context<AppEnv>,
  code: string,
  message: string,
  status: 400 | 404 | 500,
): Response {
  return context.json({ error: { code, message } }, status);
}

type CreateTaskInput = {
  text: string;
  horizon: TaskHorizon;
  timeZone: string;
};

type TaskRow = {
  id: string;
  user_id: string;
  text: string;
  horizon: TaskHorizon;
  period_key: string;
  time_zone: string;
  created_at: string;
  updated_at: string;
};
