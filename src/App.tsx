import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Task, TaskHorizon } from "./task";
import { getPeriodKey } from "./taskPeriods";
import { cleanupCurrentTasks, loadTasks, saveTasks } from "./taskStorage";
import {
  loadSoundEnabled,
  playSound,
  saveSoundEnabled,
  type SoundEffect,
} from "./sound";

type Theme = "light" | "dark";
type RemovalEffect = Exclude<SoundEffect, "add">;

type Horizon = {
  id: TaskHorizon;
  title: string;
  emptyQuote: string;
  emptySource: string;
};

const THEME_STORAGE_KEY = "todo-horizons:theme";
const TASK_EXIT_DURATION = {
  complete: 180,
  delete: 140,
} satisfies Record<RemovalEffect, number>;
const REDUCED_MOTION_EXIT_DURATION = 100;

const horizons = [
  {
    id: "today",
    title: "Today",
    emptyQuote: "You are but a collective number of days. Whenever a day passes, a part of you passes.",
    emptySource: "Hasan al-Basri",
  },
  {
    id: "week",
    title: "This Week",
    emptyQuote: "The most beloved deeds to God are those most consistent, even if they are small.",
    emptySource: "Bukhari 6464",
  },
  {
    id: "month",
    title: "This Month",
    emptyQuote: "Actions are judged by intentions.",
    emptySource: "Bukhari 1",
  },
  {
    id: "year",
    title: "This Year",
    emptyQuote: "A year is like a tree: its months are branches, its days are twigs, and its breaths are the fruit.",
    emptySource: "Ibn al-Qayyim (Al-Fawā'id)",
  },
  {
    id: "life",
    title: "Life",
    emptyQuote: "Man has nothing except that for which he strives.",
    emptySource: "Qur'an 53:39",
  },
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
  removingTasks: Readonly<Record<string, RemovalEffect>>;
  onAddTask: (horizon: TaskHorizon, text: string) => void;
  onRequestRemoval: (
    taskId: string,
    effect: RemovalEffect,
    animate: boolean,
  ) => void;
};

function HorizonColumn({
  id,
  title,
  emptyQuote,
  emptySource,
  tasks,
  removingTasks,
  onAddTask,
  onRequestRemoval,
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
            <li
              className="task-row"
              key={task.id}
              data-removing={removingTasks[task.id]}
            >
              <input
                className="task-row__checkbox"
                type="checkbox"
                aria-label={`Complete task: ${task.text}`}
                onClick={(event) =>
                  onRequestRemoval(task.id, "complete", event.detail > 0)
                }
              />
              <span className="task-row__text">{task.text}</span>
              <button
                className="task-row__delete"
                type="button"
                aria-label={`Delete task: ${task.text}`}
                onClick={(event) =>
                  onRequestRemoval(task.id, "delete", event.detail > 0)
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="horizon__empty" aria-label={`${title} empty state`}>
          <blockquote className="horizon__quote">
            <p className="horizon__quote-text">“{emptyQuote}”</p>
            <cite className="horizon__quote-source">— {emptySource}</cite>
          </blockquote>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const [removingTasks, setRemovingTasks] = useState<
    Readonly<Record<string, RemovalEffect>>
  >({});
  const removalTimers = useRef(new Map<string, number>());

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
    saveSoundEnabled(soundEnabled);
  }, [soundEnabled]);

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

  useEffect(() => {
    const timers = removalTimers.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function addTask(horizon: TaskHorizon, text: string) {
    if (soundEnabled) {
      playSound("add");
    }

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
    setRemovingTasks((currentTasks) => {
      const remainingTasks = { ...currentTasks };
      delete remainingTasks[taskId];
      return remainingTasks;
    });
    removalTimers.current.delete(taskId);
  }

  function requestTaskRemoval(
    taskId: string,
    effect: RemovalEffect,
    animate: boolean,
  ) {
    if (removalTimers.current.has(taskId)) {
      return;
    }

    if (soundEnabled) {
      playSound(effect);
    }

    if (!animate) {
      removeTask(taskId);
      return;
    }

    setRemovingTasks((currentTasks) => ({
      ...currentTasks,
      [taskId]: effect,
    }));

    const exitDuration = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
      ? REDUCED_MOTION_EXIT_DURATION
      : TASK_EXIT_DURATION[effect];
    const timer = window.setTimeout(() => removeTask(taskId), exitDuration);
    removalTimers.current.set(taskId, timer);
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
              removingTasks={removingTasks}
              onAddTask={addTask}
              onRequestRemoval={requestTaskRemoval}
            />
          );
        })}
      </div>
      <div
        className="utility-controls"
        role="group"
        aria-label="Display and sound settings"
      >
        <button
          className="utility-toggle sound-toggle"
          type="button"
          aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled((enabled) => !enabled)}
        >
          <svg
            className="utility-toggle__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
            <path
              className="sound-toggle__enabled"
              d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.5a7.8 7.8 0 0 1 0 11"
            />
            <path
              className="sound-toggle__muted"
              d="m15.5 9.5 5 5m0-5-5 5"
            />
          </svg>
        </button>
        <button
          className="utility-toggle theme-toggle"
          type="button"
          aria-label={`Switch to ${nextTheme} mode`}
          aria-pressed={theme === "dark"}
          onClick={() => setTheme(nextTheme)}
        >
          <svg
            className="utility-toggle__icon"
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
      </div>
    </main>
  );
}
