import type { Task, TaskHorizon } from "./task";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TIME_ZONE = "UTC";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getIsoWeekKey(dateParts: DateParts): string {
  const utcDate = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day),
  );
  const dayOfWeek = (utcDate.getUTCDay() + 6) % 7;

  utcDate.setUTCDate(utcDate.getUTCDate() - dayOfWeek + 3);

  const weekYear = utcDate.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;

  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayOfWeek + 3,
  );

  const weekNumber =
    1 +
    Math.round(
      (utcDate.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY),
    );

  return `${weekYear}-W${pad2(weekNumber)}`;
}

export function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
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

export function getPeriodKey(
  horizon: TaskHorizon,
  date = new Date(),
  timeZone = getTimeZone(),
): string {
  const { year, month, day } = getDateParts(date, timeZone);

  switch (horizon) {
    case "today":
      return `${year}-${pad2(month)}-${pad2(day)}`;
    case "week":
      return getIsoWeekKey({ year, month, day });
    case "month":
      return `${year}-${pad2(month)}`;
    case "year":
      return String(year);
    case "life":
      return "life";
  }
}

export function isTaskCurrent(task: Task, date = new Date()): boolean {
  if (task.horizon === "life") {
    return true;
  }

  return task.periodKey === getPeriodKey(task.horizon, date, task.timeZone);
}
