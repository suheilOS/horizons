import type { Task, TaskHorizon } from "./task";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getLocalDateParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function getLocalIsoWeekKey(date: Date): string {
  const { year, month, day } = getLocalDateParts(date);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = (utcDate.getUTCDay() + 6) % 7;

  utcDate.setUTCDate(utcDate.getUTCDate() - dayOfWeek + 3);

  const weekYear = utcDate.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDayOfWeek = (firstThursday.getUTCDay() + 6) % 7;

  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstThursdayDayOfWeek + 3,
  );

  const weekNumber =
    1 + Math.round((utcDate.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));

  return `${weekYear}-W${pad2(weekNumber)}`;
}

export function getPeriodKey(horizon: TaskHorizon, date = new Date()): string {
  const { year, month, day } = getLocalDateParts(date);

  switch (horizon) {
    case "today":
      return `${year}-${pad2(month)}-${pad2(day)}`;
    case "week":
      return getLocalIsoWeekKey(date);
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

  return task.periodKey === getPeriodKey(task.horizon, date);
}
