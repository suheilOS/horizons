import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Task, TaskHorizon } from "./task";
import { getTimeZone } from "./taskPeriods";
import { loadSoundEnabled, playSound, saveSoundEnabled, type SoundEffect } from "./sound";
import { useTaskList } from "./useTaskList";
import { UtilityDock } from "./UtilityDock";

type Theme = "light" | "dark";
type RemovalEffect = Exclude<SoundEffect, "add">;

type Horizon = {
  id: TaskHorizon;
  title: string;
};

const THEME_STORAGE_KEY = "todo-horizons:theme";
const TASK_EXIT_DURATION = {
  complete: 180,
  delete: 140,
} satisfies Record<RemovalEffect, number>;
const REDUCED_MOTION_EXIT_DURATION = 100;

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
  removingTasks: Readonly<Record<string, RemovalEffect>>;
  onAddTask: (horizon: TaskHorizon, text: string) => Promise<boolean>;
  onRequestRemoval: (taskId: string, effect: RemovalEffect) => void;
};

function HorizonColumn({
  id,
  title,
  tasks,
  removingTasks,
  onAddTask,
  onRequestRemoval,
}: HorizonColumnProps) {
  const [draft, setDraft] = useState("");
  const headingId = `${id}-heading`;
  const inputId = `${id}-task-input`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();
    if (text.length === 0) {
      setDraft("");
      return;
    }

    const added = await onAddTask(id, text);
    if (added) {
      setDraft("");
    }
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

      {tasks.length > 0 && (
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
                checked={removingTasks[task.id] === "complete"}
                aria-label={`Complete task: ${task.text}`}
                onChange={() => onRequestRemoval(task.id, "complete")}
              />
              <span className="task-row__text">{task.text}</span>
              <button
                className="task-row__delete"
                type="button"
                aria-label={`Delete task: ${task.text}`}
                onClick={() => onRequestRemoval(task.id, "delete")}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const {
    tasks,
    loading,
    busy,
    error,
    unauthenticated,
    retry,
    addTask: addTaskToServer,
    removeTask: removeTaskFromServer,
  } = useTaskList();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const [removingTasks, setRemovingTasks] = useState<
    Readonly<Record<string, RemovalEffect>>
  >({});
  const removalTimers = useRef(new Map<string, number>());

  const nextTheme = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.add("theme-switching");
    void root.offsetWidth;

    const frame = requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the selected theme for this session if storage is unavailable.
    }

    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("theme-switching");
    };
  }, [theme]);

  useEffect(() => {
    saveSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    function refreshTasks() {
      if (document.visibilityState === "visible") {
        retry();
      }
    }

    document.addEventListener("visibilitychange", refreshTasks);

    return () => {
      document.removeEventListener("visibilitychange", refreshTasks);
    };
  }, [retry]);

  useEffect(() => {
    const timers = removalTimers.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  async function addTask(horizon: TaskHorizon, text: string): Promise<boolean> {
    const added = await addTaskToServer({
      text,
      horizon,
      timeZone: getTimeZone(),
    });

    if (added && soundEnabled) {
      playSound("add");
    }

    return added;
  }

  function clearRemovingTask(taskId: string) {
    setRemovingTasks((currentTasks) => {
      const remainingTasks = { ...currentTasks };
      delete remainingTasks[taskId];
      return remainingTasks;
    });
    removalTimers.current.delete(taskId);
  }

  function requestTaskRemoval(taskId: string, effect: RemovalEffect) {
    if (removalTimers.current.has(taskId)) {
      return;
    }

    if (soundEnabled) {
      playSound(effect);
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
    const timer = window.setTimeout(() => {
      void removeTaskFromServer(taskId).finally(() => {
        clearRemovingTask(taskId);
      });
    }, exitDuration);
    removalTimers.current.set(taskId, timer);
  }

  const utilityControls = (
    <UtilityDock
      authenticated={!loading && !unauthenticated}
      theme={theme}
      soundEnabled={soundEnabled}
      onToggleTheme={() => setTheme(nextTheme)}
      onToggleSound={() => setSoundEnabled((enabled) => !enabled)}
    />
  );

  if (loading) {
    return (
      <main className="app app-state">
        <p className="app-state__message" role="status">
          Loading your horizons…
        </p>
        {utilityControls}
      </main>
    );
  }

  if (unauthenticated) {
    return <SignedOutState utilityControls={utilityControls} />;
  }

  if (error !== null && tasks.length === 0) {
    return (
      <main className="app app-state">
        <section className="app-state__content" aria-labelledby="error-title">
          <h1 className="app-state__title" id="error-title">
            Horizons is unavailable
          </h1>
          <p className="app-state__message">{error}</p>
          <button className="app-state__action" type="button" onClick={retry}>
            Try again
          </button>
        </section>
        {utilityControls}
      </main>
    );
  }

  return (
    <main className="app" aria-busy={busy}>
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
      {error !== null && (
        <div className="app-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {utilityControls}
    </main>
  );
}

type SignedOutStateProps = {
  utilityControls: ReactNode;
};

function getAuthOrigin(): string {
  const configuredOrigin = import.meta.env.VITE_AUTH_ORIGIN;
  if (configuredOrigin !== undefined) {
    return configuredOrigin;
  }

  const host = window.location.hostname;
  if (import.meta.env.DEV || host === "localhost" || host === "127.0.0.1") {
    return `http://${host}:8788`;
  }

  return "https://auth.overhawl.app";
}

function SignedOutState({ utilityControls }: SignedOutStateProps) {
  const authUrl = getAuthOrigin();
  const signInUrl = `${authUrl}/?redirectTo=${encodeURIComponent(window.location.href)}`;

  return (
    <main className="app app-state">
      <section className="app-state__content" aria-labelledby="signed-out-title">
        <h1 className="app-state__title" id="signed-out-title">
          Sign in to Horizons
        </h1>
        <p className="app-state__message">
          Sign in to keep your horizons available wherever you work.
        </p>
        <a className="app-state__action" href={signInUrl}>
          Sign in
        </a>
      </section>
      {utilityControls}
    </main>
  );
}
