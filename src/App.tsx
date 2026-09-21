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
    requestTaskRemoval(taskId, "delete", true);
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

  function requestTaskRemoval(
    taskId: string,
    effect: RemovalEffect,
    notify = false,
  ) {
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
      void removeTaskFromServer(taskId).then((removed) => {
        clearRemovingTask(taskId);
        if (!notify) return;

        if (removed) {
          toast.success("Task deleted");
        } else {
          toast.error("Could not delete task", {
            id: `task-delete-error-${taskId}`,
            description: "The task is still in your horizons.",
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "Retry",
              onClick: () => requestTaskRemoval(taskId, effect, true),
            },
          });
        }
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
      className="app-toaster"
      theme={theme}
      position="top-center"
      gap={8}
      visibleToasts={3}
      swipeDirections={["top", "bottom", "left", "right"]}
      offset={16}
      mobileOffset={16}
      containerAriaLabel="Notifications"
      toastOptions={{
        className: "app-toast",
        closeButton: false,
        duration: 3_500,
      }}
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
          <header className="task-detail__header">
            <button
              className="task-detail__back"
              type="button"
              onClick={() => void closeAfterSave()}
              disabled={closing}
              aria-label={closing ? "Saving changes" : "Back to horizons"}
            >
              <BackIcon />
            </button>
            <button
              className="task-detail__delete"
              type="button"
              aria-label={`Delete task: ${task.text}`}
              onClick={() => {
                toast("Delete this task?", {
                  id: `task-delete-confirmation-${task.id}`,
                  duration: 6_000,
                  icon: <TrashIcon />,
                  action: {
                    label: "Delete",
                    onClick: () => {
                      if (saveTimerRef.current !== null) {
                        window.clearTimeout(saveTimerRef.current);
                        saveTimerRef.current = null;
                      }
                      onDelete(task.id);
                    },
                  },
                });
              }}
            >
              <TrashIcon />
            </button>
          </header>

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
        </div>
      </section>
    </ViewTransition>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M14.9998 19.9201L8.47984 13.4001C7.70984 12.6301 7.70984 11.3701 8.47984 10.6001L14.9998 4.08008"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.3094 2.25002H13.6908C13.9072 2.24988 14.0957 2.24976 14.2737 2.27819C14.977 2.39049 15.5856 2.82915 15.9146 3.46084C15.9978 3.62073 16.0573 3.79961 16.1256 4.00494L16.2373 4.33984C16.2562 4.39653 16.2616 4.41258 16.2661 4.42522C16.4413 4.90933 16.8953 5.23659 17.4099 5.24964C17.4235 5.24998 17.44 5.25004 17.5001 5.25004H20.5001C20.9143 5.25004 21.2501 5.58582 21.2501 6.00004C21.2501 6.41425 20.9143 6.75004 20.5001 6.75004H3.5C3.08579 6.75004 2.75 6.41425 2.75 6.00004C2.75 5.58582 3.08579 5.25004 3.5 5.25004H6.50008C6.56013 5.25004 6.5767 5.24998 6.59023 5.24964C7.10488 5.23659 7.55891 4.90936 7.73402 4.42524C7.73863 4.41251 7.74392 4.39681 7.76291 4.33984L7.87452 4.00496C7.94281 3.79964 8.00233 3.62073 8.08559 3.46084C8.41453 2.82915 9.02313 2.39049 9.72643 2.27819C9.90445 2.24976 10.093 2.24988 10.3094 2.25002ZM9.00815 5.25004C9.05966 5.14902 9.10531 5.04404 9.14458 4.93548C9.1565 4.90251 9.1682 4.86742 9.18322 4.82234L9.28302 4.52292C9.37419 4.24941 9.39519 4.19363 9.41601 4.15364C9.52566 3.94307 9.72853 3.79686 9.96296 3.75942C10.0075 3.75231 10.067 3.75004 10.3553 3.75004H13.6448C13.9331 3.75004 13.9927 3.75231 14.0372 3.75942C14.2716 3.79686 14.4745 3.94307 14.5842 4.15364C14.605 4.19363 14.626 4.2494 14.7171 4.52292L14.8169 4.82216L14.8556 4.9355C14.8949 5.04405 14.9405 5.14902 14.992 5.25004H9.00815Z" fill="currentColor" />
      <path d="M5.91509 8.45015C5.88754 8.03685 5.53016 7.72415 5.11686 7.7517C4.70357 7.77925 4.39086 8.13663 4.41841 8.54993L4.88186 15.5017C4.96736 16.7844 5.03642 17.8205 5.19839 18.6336C5.36679 19.4789 5.65321 20.185 6.2448 20.7385C6.8364 21.2919 7.55995 21.5308 8.4146 21.6425C9.23662 21.7501 10.275 21.7501 11.5606 21.75H12.4395C13.7251 21.7501 14.7635 21.7501 15.5856 21.6425C16.4402 21.5308 17.1638 21.2919 17.7554 20.7385C18.347 20.185 18.6334 19.4789 18.8018 18.6336C18.9638 17.8206 19.0328 16.7844 19.1183 15.5017L19.5818 8.54993C19.6093 8.13663 19.2966 7.77925 18.8833 7.7517C18.47 7.72415 18.1126 8.03685 18.0851 8.45015L17.6251 15.3493C17.5353 16.6971 17.4713 17.6349 17.3307 18.3406C17.1943 19.025 17.004 19.3873 16.7306 19.6431C16.4572 19.8989 16.083 20.0647 15.391 20.1552C14.6776 20.2485 13.7376 20.25 12.3868 20.25H11.6134C10.2626 20.25 9.32255 20.2485 8.60915 20.1552C7.91715 20.0647 7.54299 19.8989 7.26958 19.6431C6.99617 19.3873 6.80583 19.025 6.66948 18.3406C6.52892 17.6349 6.46489 16.6971 6.37503 15.3493L5.91509 8.45015Z" fill="currentColor" />
      <path d="M9.42546 10.2538C9.83762 10.2125 10.2052 10.5133 10.2464 10.9254L10.7464 15.9254C10.7876 16.3376 10.4869 16.7051 10.0747 16.7463C9.66256 16.7875 9.29503 16.4868 9.25381 16.0747L8.75381 11.0747C8.7126 10.6625 9.01331 10.295 9.42546 10.2538Z" fill="currentColor" />
      <path d="M14.5747 10.2538C14.9869 10.295 15.2876 10.6625 15.2464 11.0747L14.7464 16.0747C14.7052 16.4868 14.3376 16.7875 13.9255 16.7463C13.5133 16.7051 13.2126 16.3376 13.2538 15.9254L13.7538 10.9254C13.795 10.5133 14.1626 10.2125 14.5747 10.2538Z" fill="currentColor" />
    </svg>
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
