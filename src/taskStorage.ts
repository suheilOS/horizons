import type { Task, TaskHorizon } from "./task";
import { getPeriodKey, isTaskCurrent } from "./taskPeriods";

const STORAGE_KEY = "todo-horizons:tasks";

type StoredTaskDataV1 = {
  version: 1;
  tasks: Array<{
    id: string;
    text: string;
    horizon: TaskHorizon;
  }>;
};

type StoredTaskDataV2 = {
  version: 2;
  tasks: Task[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskHorizon(value: unknown): value is TaskHorizon {
  switch (value) {
    case "today":
    case "week":
    case "month":
    case "year":
    case "life":
      return true;
    default:
      return false;
  }
}

function parseTaskFields(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const { id, text, horizon } = value;

  if (typeof id !== "string" || id.length === 0) {
    return null;
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  if (!isTaskHorizon(horizon)) {
    return null;
  }

  return {
    id,
    text,
    horizon,
  };
}

function parseVersion1Task(value: unknown): StoredTaskDataV1["tasks"][number] | null {
  return parseTaskFields(value);
}

function parseVersion2Task(value: unknown): Task | null {
  const parsedFields = parseTaskFields(value);

  if (parsedFields === null || !isRecord(value)) {
    return null;
  }

  if (typeof value.periodKey !== "string" || value.periodKey.length === 0) {
    return null;
  }

  return {
    ...parsedFields,
    periodKey: value.periodKey,
  };
}

function parseStoredTaskData(value: unknown): StoredTaskDataV2 {
  if (!isRecord(value) || !Array.isArray(value.tasks)) {
    return {
      version: 2,
      tasks: [],
    };
  }

  if (value.version === 1) {
    return {
      version: 2,
      tasks: value.tasks.flatMap((task) => {
        const parsedTask = parseVersion1Task(task);
        return parsedTask === null
          ? []
          : [
              {
                ...parsedTask,
                periodKey: getPeriodKey(parsedTask.horizon),
              },
            ];
      }),
    };
  }

  if (value.version === 2) {
    return {
      version: 2,
      tasks: value.tasks.flatMap((task) => {
        const parsedTask = parseVersion2Task(task);
        return parsedTask === null ? [] : [parsedTask];
      }),
    };
  }

  return {
    version: 2,
    tasks: [],
  };
}

export function cleanupCurrentTasks(tasks: Task[], date = new Date()): Task[] {
  return tasks.filter((task) => isTaskCurrent(task, date));
}

export function loadTasks(date = new Date()): Task[] {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      return [];
    }

    return cleanupCurrentTasks(parseStoredTaskData(JSON.parse(storedValue)).tasks, date);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    const storedData: StoredTaskDataV2 = {
      version: 2,
      tasks,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
  } catch {
    // Keep the in-memory session usable if browser storage is unavailable.
  }
}
