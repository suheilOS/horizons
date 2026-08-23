import { describe, expect, it } from "vitest";
import { getPeriodKey } from "../shared/task-periods";
import {
  TASK_HORIZONS,
  isTask,
  isTaskHorizon,
  isValidTimeZone,
} from "../shared/task";

describe("task contracts", () => {
  it("uses the canonical horizon list for runtime validation", () => {
    expect(TASK_HORIZONS.every(isTaskHorizon)).toBe(true);
    expect(isTaskHorizon("later")).toBe(false);
  });

  it("validates tasks at API boundaries", () => {
    expect(isTask({
      id: "task-1",
      text: "Ship shared contracts",
      horizon: "week",
      periodKey: "2026-W34",
      timeZone: "Europe/Istanbul",
    })).toBe(true);
    expect(isTask({
      id: "task-2",
      text: "Reject an unknown horizon",
      horizon: "later",
      periodKey: "later",
      timeZone: "Europe/Istanbul",
    })).toBe(false);
  });
});

describe("task periods", () => {
  it("uses the task timezone for calendar boundaries", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");

    expect(getPeriodKey("today", instant, "America/Los_Angeles")).toBe("2025-12-31");
    expect(getPeriodKey("month", instant, "America/Los_Angeles")).toBe("2025-12");
    expect(getPeriodKey("year", instant, "America/Los_Angeles")).toBe("2025");
  });

  it("uses ISO week years in the task timezone", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");

    expect(getPeriodKey("week", instant, "America/Los_Angeles")).toBe("2026-W01");
  });

  it("validates IANA timezone names", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});
