export const TASK_HORIZONS = [
  "today",
  "week",
  "month",
  "year",
  "life",
] as const;

export type TaskHorizon = (typeof TASK_HORIZONS)[number];

export type Task = {
  id: string;
  text: string;
  horizon: TaskHorizon;
  periodKey: string;
  timeZone: string;
};

export function isTaskHorizon(value: unknown): value is TaskHorizon {
  return TASK_HORIZONS.some((horizon) => horizon === value);
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    isTaskHorizon(value.horizon) &&
    typeof value.periodKey === "string" &&
    isValidTimeZone(value.timeZone)
  );
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
