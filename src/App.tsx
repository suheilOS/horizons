import { useEffect, useState, type FormEvent } from "react";
import type { Task, TaskHorizon } from "./task";
import { getPeriodKey } from "./taskPeriods";
import { cleanupCurrentTasks, loadTasks, saveTasks } from "./taskStorage";

type Theme = "light" | "dark";

type Horizon = {
  id: TaskHorizon;
  title: string;
};

const THEME_STORAGE_KEY = "todo-horizons:theme";

const horizons = [
  { id: "today", title: "Today" },
  { id: "week", title: "This Week" },
  { id: "month", title: "This Month" },
  { id: "year", title: "This Year" },
  { id: "life", title: "Life" },
] satisfies Horizon[];

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function getInitialTheme(): Theme {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (isTheme(storedTheme)) {
      return storedTheme;
    }
  } catch {
    // Fall back to the system preference when storage is unavailable.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

type HorizonColumnProps = Horizon & {
  tasks: Task[];
  onAddTask: (horizon: TaskHorizon, text: string) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
};

function HorizonColumn({
  id,
  title,
  tasks,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
}: HorizonColumnProps) {
  const [draft, setDraft] = useState("");
  const headingId = `${id}-heading`;
  const inputId = `${id}-task-input`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();
    if (text.length === 0) {
      setDraft("");
      return;
    }

    onAddTask(id, text);
    setDraft("");
  }

  return (
    <section className="horizon" aria-labelledby={headingId}>
      <header className="horizon__header">
        <h2 className="horizon__title" id={headingId}>
          {title}
        </h2>
      </header>

      <form className="task-entry" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={inputId}>
          Add a task to {title}
        </label>
        <input
          className="task-entry__input"
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Add a task"
          autoComplete="off"
        />
      </form>

      {tasks.length > 0 ? (
        <ul className="task-list" aria-label={`${title} tasks`}>
          {tasks.map((task) => (
            <li className="task-row" key={task.id}>
              <input
                className="task-row__checkbox"
                type="checkbox"
                aria-label={`Complete task: ${task.text}`}
                onChange={() => onCompleteTask(task.id)}
              />
              <span className="task-row__text">{task.text}</span>
              <button
                className="task-row__delete"
                type="button"
                aria-label={`Delete task: ${task.text}`}
                onClick={() => onDeleteTask(task.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="horizon__empty" aria-label={`${title} empty state`}>
          <p>Nothing here yet.</p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const nextTheme = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the selected theme for this session if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    function removeStaleTasks() {
      if (document.visibilityState !== "visible") {
        return;
      }

      setTasks((currentTasks) => cleanupCurrentTasks(currentTasks));
    }

    document.addEventListener("visibilitychange", removeStaleTasks);

    return () => {
      document.removeEventListener("visibilitychange", removeStaleTasks);
    };
  }, []);

  function addTask(horizon: TaskHorizon, text: string) {
    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: crypto.randomUUID(),
        text,
        horizon,
        periodKey: getPeriodKey(horizon),
      },
    ]);
  }

  function removeTask(taskId: string) {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
  }

  return (
    <main className="app" aria-labelledby="app-title">
      <h1 className="visually-hidden" id="app-title">
        Tasks
      </h1>
      <div className="workspace" aria-label="Task horizons">
        {horizons.map((horizon) => {
          const horizonTasks = tasks.filter(
            (task) => task.horizon === horizon.id,
          );

          return (
            <HorizonColumn
              key={horizon.id}
              {...horizon}
              tasks={horizonTasks}
              onAddTask={addTask}
              onCompleteTask={removeTask}
              onDeleteTask={removeTask}
            />
          );
        })}
      </div>
      <button
        className="theme-toggle"
        type="button"
        aria-label={`Switch to ${nextTheme} mode`}
        aria-pressed={theme === "dark"}
        onClick={() => setTheme(nextTheme)}
      >
        <svg
          className="theme-toggle__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <circle className="theme-toggle__sun" cx="12" cy="12" r="4" />
          <path
            className="theme-toggle__sun"
            d="M12 2.75v2.1M12 19.15v2.1M21.25 12h-2.1M4.85 12h-2.1M18.54 5.46l-1.49 1.49M6.95 17.05l-1.49 1.49M18.54 18.54l-1.49-1.49M6.95 6.95 5.46 5.46"
          />
          <path
            className="theme-toggle__moon"
            d="M20.25 14.65A8.1 8.1 0 0 1 9.35 3.75a8.7 8.7 0 1 0 10.9 10.9Z"
          />
        </svg>
      </button>
    </main>
  );
}
