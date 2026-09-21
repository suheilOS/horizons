import {
  Activity,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  ViewTransition,
} from "react";
import { Toaster, toast } from "sonner";
import { TASK_HORIZONS, type Task, type TaskHorizon } from "../shared/task";
import { getTimeZone } from "../shared/task-periods";
import { loadSoundEnabled, playSound, saveSoundEnabled, type SoundEffect } from "./sound";
import { useTaskList } from "./useTaskList";
import { UtilityDock } from "./UtilityDock";
import { TwinOrbit } from "./components/TwinOrbit";

type Theme = "light" | "dark";
type RemovalEffect = Exclude<SoundEffect, "add">;

type Horizon = {
  id: TaskHorizon;
  title: string;
  placeholder: string;
};

const THEME_STORAGE_KEY = "todo-horizons:theme";
const TASK_EXIT_DURATION = {
  complete: 180,
  delete: 140,
} satisfies Record<RemovalEffect, number>;
const REDUCED_MOTION_EXIT_DURATION = 100;

const HORIZON_DETAILS = {
  today: { title: "Today", placeholder: "Add a next step" },
  week: { title: "This Week", placeholder: "Add a priority" },
  month: { title: "This Month", placeholder: "Add a milestone" },
  year: { title: "This Year", placeholder: "Add an ambition" },
  life: { title: "Life", placeholder: "Add a life goal" },
} satisfies Record<TaskHorizon, Omit<Horizon, "id">>;
const horizons: Horizon[] = TASK_HORIZONS.map((id) => ({
  id,
  ...HORIZON_DETAILS[id],
}));

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
  onOpenTask: (taskId: string) => void;
  onRequestRemoval: (taskId: string, effect: RemovalEffect) => void;
  registerTaskOpenButton: (
    taskId: string,
    element: HTMLButtonElement | null,
  ) => void;
};

function HorizonColumn({
  id,
  title,
  placeholder,
  tasks,
  removingTasks,
  onAddTask,
  onOpenTask,
  onRequestRemoval,
  registerTaskOpenButton,
}: HorizonColumnProps) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const headingId = `${id}-heading`;
  const inputId = `${id}-task-input`;
  const canSubmit = draft.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    const text = draft.trim();
    if (text.length === 0) {
      setDraft("");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const added = await onAddTask(id, text);
      if (added) {
        setDraft("");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="horizon" aria-labelledby={headingId}>
      <header className="horizon__header">
        <h2 className="horizon__title" id={headingId}>
          {title}
        </h2>
      </header>

      <form className="task-entry" aria-busy={submitting} onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor={inputId}>
          Add a task to {title}
        </label>
        <input
          className="task-entry__input"
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder={placeholder}
          autoComplete="off"
          readOnly={submitting}
        />
        <span className="visually-hidden" role="status" aria-atomic="true">
          {submitting ? `Adding task to ${title}.` : ""}
        </span>
        <button
          className="task-entry__submit"
          type="submit"
          aria-label={`Add task to ${title}`}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <span className="task-entry__spinner" aria-hidden="true" />
          ) : canSubmit ? (
            <span className="task-entry__plus" aria-hidden="true">+</span>
          ) : null}
        </button>
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
              <button
                className="task-row__open"
                type="button"
                ref={(element) => registerTaskOpenButton(task.id, element)}
                aria-label={`Open task: ${task.text}`}
                onClick={() => onOpenTask(task.id)}
              >
                <ViewTransition
                  name={`task-title-${task.id}`}
                  share="text-morph"
                  default="none"
                >
                  <span className="task-row__text">{task.text}</span>
                </ViewTransition>
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
    refresh,
    addTask: addTaskToServer,
    updateTaskDescription: updateTaskDescriptionOnServer,
    removeTask: removeTaskFromServer,
  } = useTaskList();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [soundEnabled, setSoundEnabled] = useState(loadSoundEnabled);
  const [removingTasks, setRemovingTasks] = useState<
    Readonly<Record<string, RemovalEffect>>
  >({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const removalTimers = useRef(new Map<string, number>());
  const taskOpenButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusTaskId = useRef<string | null>(null);
  const selectedTask = selectedTaskId === null
    ? null
    : tasks.find((task) => task.id === selectedTaskId) ?? null;
  const tasksByHorizon = useMemo(() => {
    const grouped: Record<TaskHorizon, Task[]> = {
      today: [],
      week: [],
      month: [],
      year: [],
      life: [],
    };

    for (const task of tasks) {
      grouped[task.horizon].push(task);
    }

    return grouped;
  }, [tasks]);

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
        refresh();
      }
    }

    document.addEventListener("visibilitychange", refreshTasks);

    return () => {
      document.removeEventListener("visibilitychange", refreshTasks);
    };
  }, [refresh]);

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

  function openTask(taskId: string) {
    returnFocusTaskId.current = taskId;
    startTransition(() => setSelectedTaskId(taskId));
  }

  function closeTask() {
    startTransition(() => setSelectedTaskId(null));
  }

  function deleteSelectedTask(taskId: string) {
    returnFocusTaskId.current = null;
    requestTaskRemoval(taskId, "delete");
    closeTask();
  }

  function registerTaskOpenButton(
    taskId: string,
    element: HTMLButtonElement | null,
  ) {
    if (element === null) {
      taskOpenButtons.current.delete(taskId);
    } else {
      taskOpenButtons.current.set(taskId, element);
    }
  }

  async function saveTaskDescription(
    taskId: string,
    description: string,
  ): Promise<boolean> {
    const saved = await updateTaskDescriptionOnServer(taskId, description);
    if (saved) {
      toast.dismiss("description-save-error");
    } else {
      toast.error("Could not save description", {
        id: "description-save-error",
        description: "Your changes are still in the editor. Try again.",
        duration: Number.POSITIVE_INFINITY,
      });
    }
    return saved;
  }

  useEffect(() => {
    if (selectedTaskId !== null || returnFocusTaskId.current === null) {
      return;
    }

    const taskId = returnFocusTaskId.current;
    const openButton = taskOpenButtons.current.get(taskId);
    if (openButton !== undefined) {
      openButton.dataset.restoredFocus = "";
      openButton.focus({ preventScroll: true });
      openButton.addEventListener(
        "blur",
        () => delete openButton.dataset.restoredFocus,
        { once: true },
      );
    }
    returnFocusTaskId.current = null;
  }, [selectedTaskId]);

  useEffect(() => {
    if (selectedTaskId !== null && selectedTask === null) {
      startTransition(() => setSelectedTaskId(null));
    }
  }, [selectedTask, selectedTaskId]);

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
  const toastLayer = (
    <Toaster
      theme={theme}
      position="bottom-center"
      closeButton
      toastOptions={{ duration: 3_500 }}
    />
  );

  if (loading) {
    return (
      <>
        <main className="app app-state">
          <section className="app-state__content" aria-labelledby="loading-title">
            <h1 className="app-state__title" id="loading-title">
              Horizons
            </h1>
            <div className="app-loading">
              <TwinOrbit label="Loading your horizons" />
              <p className="app-state__message" aria-hidden="true">
                Loading your horizons…
              </p>
            </div>
          </section>
          {utilityControls}
        </main>
        {toastLayer}
      </>
    );
  }

  if (unauthenticated) {
    return (
      <>
        <SignedOutState utilityControls={utilityControls} />
        {toastLayer}
      </>
    );
  }

  if (error !== null && tasks.length === 0) {
    return (
      <>
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
        {toastLayer}
      </>
    );
  }

  return (
    <>
      <main className="app" aria-busy={busy}>
        <h1 className="visually-hidden" id="app-title">
          Tasks
        </h1>
        <ViewTransition default="none">
          <Activity mode={selectedTask === null ? "visible" : "hidden"}>
            <div className="workspace" aria-label="Task horizons">
              {horizons.map((horizon) => (
                <HorizonColumn
                  key={horizon.id}
                  {...horizon}
                  tasks={tasksByHorizon[horizon.id]}
                  removingTasks={removingTasks}
                  onAddTask={addTask}
                  onOpenTask={openTask}
                  onRequestRemoval={requestTaskRemoval}
                  registerTaskOpenButton={registerTaskOpenButton}
                />
              ))}
            </div>
          </Activity>
          {selectedTask !== null && (
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              onClose={closeTask}
              onDelete={deleteSelectedTask}
              onSaveDescription={saveTaskDescription}
            />
          )}
        </ViewTransition>
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
      {toastLayer}
    </>
  );
}

type TaskDetailProps = {
  task: Task;
  onClose: () => void;
  onDelete: (taskId: string) => void;
  onSaveDescription: (taskId: string, description: string) => Promise<boolean>;
};

function TaskDetail({ task, onClose, onDelete, onSaveDescription }: TaskDetailProps) {
  const [draft, setDraft] = useState(task.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [closing, setClosing] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(task.description);
  const savedDescriptionRef = useRef(task.description);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const flushDescriptionRef = useRef<() => Promise<boolean>>(async () => true);
  const closingRef = useRef(false);
  const titleId = `task-detail-title-${task.id}`;
  const descriptionId = `task-detail-description-${task.id}`;

  useEffect(() => {
    const editor = descriptionRef.current;
    if (editor === null) return;

    editor.focus({ preventScroll: true });
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }, []);

  useEffect(() => {
    if (task.description === savedDescriptionRef.current) return;

    const draftWasClean = draftRef.current.trim() === savedDescriptionRef.current;
    savedDescriptionRef.current = task.description;
    if (draftWasClean) {
      draftRef.current = task.description;
      setDraft(task.description);
    }
  }, [task.description]);

  async function flushDescription(): Promise<boolean> {
    while (true) {
      if (saveInFlightRef.current !== null) {
        const saved = await saveInFlightRef.current;
        if (!saved) return false;
        continue;
      }

      const description = draftRef.current.trim();
      if (description === savedDescriptionRef.current) return true;

      const request = onSaveDescription(task.id, description);
      saveInFlightRef.current = request;
      const saved = await request;
      if (saveInFlightRef.current === request) {
        saveInFlightRef.current = null;
      }
      if (!saved) return false;

      savedDescriptionRef.current = description;
    }
  }

  flushDescriptionRef.current = flushDescription;

  useEffect(() => {
    if (draft.trim() === savedDescriptionRef.current) return;

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushDescriptionRef.current();
    }, 800);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [draft]);

  async function closeAfterSave() {
    if (closingRef.current) return;

    closingRef.current = true;
    setClosing(true);
    const saved = await flushDescription();
    if (saved) {
      onClose();
      return;
    }

    closingRef.current = false;
    setClosing(false);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closingRef.current) {
        event.preventDefault();
        void closeAfterSave();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <ViewTransition
      enter="task-detail-enter"
      exit="task-detail-exit"
      default="none"
    >
      <section className="task-detail" aria-labelledby={titleId}>
        <div className="task-detail__content">
          <button
            className="task-detail__back"
            type="button"
            onClick={() => void closeAfterSave()}
            disabled={closing}
          >
            {closing ? "Saving…" : "Back"}
          </button>

          <ViewTransition
            name={`task-title-${task.id}`}
            share="text-morph"
            default="none"
          >
            <h2 className="task-detail__title" id={titleId}>
              {task.text}
            </h2>
          </ViewTransition>

          <div className="task-detail__form">
            <label className="visually-hidden" htmlFor={descriptionId}>
              Description
            </label>
            <textarea
              ref={descriptionRef}
              className="task-detail__textarea"
              id={descriptionId}
              value={draft}
              maxLength={4_000}
              placeholder="Add a description…"
              onChange={(event) => {
                const description = event.currentTarget.value;
                draftRef.current = description;
                setDraft(description);
              }}
            />
          </div>

          <div className="task-detail__delete-area" aria-live="polite">
            {confirmingDelete ? (
              <>
                <button
                  className="task-detail__delete task-detail__delete--confirm"
                  type="button"
                  onClick={() => {
                    if (saveTimerRef.current !== null) {
                      window.clearTimeout(saveTimerRef.current);
                      saveTimerRef.current = null;
                    }
                    onDelete(task.id);
                  }}
                >
                  Delete task?
                </button>
                <button
                  className="task-detail__cancel-delete"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="task-detail__delete"
                type="button"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete task
              </button>
            )}
          </div>
        </div>
      </section>
    </ViewTransition>
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
