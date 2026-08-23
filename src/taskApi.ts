import { isTask, type Task, type TaskHorizon } from "../shared/task";

export type NewTaskInput = {
  text: string;
  horizon: TaskHorizon;
  timeZone: string;
};

type TasksResponse = { tasks: Task[] };

type TaskResponse = { task: Task };

export class TaskApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TaskApiError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchTasks(signal?: AbortSignal): Promise<Task[]> {
  const response = await request("/api/tasks", { signal });
  const body = readTasksResponse(response);
  return body.tasks;
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const response = await request("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readTaskResponse(response).task;
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<{ body: unknown }> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
  } catch {
    throw new TaskApiError(
      "Horizons could not reach the server. Try again.",
      0,
      "network_error",
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Keep the HTTP status as the useful error when the server returned no JSON.
  }

  if (!response.ok) {
    throw new TaskApiError(
      readErrorMessage(body) ?? "Horizons could not complete that request. Try again.",
      response.status,
      readErrorCode(body) ?? `http_${response.status}`,
    );
  }

  return { body };
}

function readTasksResponse(response: { body: unknown }): TasksResponse {
  if (
    !isRecord(response.body) ||
    !Array.isArray(response.body.tasks) ||
    !response.body.tasks.every(isTask)
  ) {
    throw new TaskApiError(
      "The server returned invalid tasks.",
      502,
      "invalid_response",
    );
  }

  return { tasks: response.body.tasks };
}

function readTaskResponse(response: { body: unknown }): TaskResponse {
  if (!isRecord(response.body) || !isTask(response.body.task)) {
    throw new TaskApiError(
      "The server returned an invalid task.",
      502,
      "invalid_response",
    );
  }

  return { task: response.body.task };
}

function readErrorMessage(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== "string") {
    return null;
  }

  return value.error.message;
}

function readErrorCode(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.code !== "string") {
    return null;
  }

  return value.error.code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
