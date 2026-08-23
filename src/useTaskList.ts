import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "./task";
import {
  createTask,
  deleteTask,
  fetchTasks,
  TaskApiError,
  type NewTaskInput,
} from "./taskApi";

type TaskMutation = () => Promise<void>;

export type TaskList = {
  tasks: Task[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  unauthenticated: boolean;
  retry: () => void;
  addTask: (input: NewTaskInput) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
};

export function useTaskList(): TaskList {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMutations, setActiveMutations] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const dataGenerationRef = useRef(0);

  useEffect(() => {
    const generation = dataGenerationRef.current + 1;
    dataGenerationRef.current = generation;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void fetchTasks(controller.signal)
      .then((nextTasks) => {
        if (generation !== dataGenerationRef.current) {
          return;
        }

        setTasks(nextTasks);
        setUnauthenticated(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        handleError(error, setError, setUnauthenticated);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadToken]);

  const runMutation = useCallback(async (operation: TaskMutation): Promise<boolean> => {
    dataGenerationRef.current += 1;
    setActiveMutations((current) => current + 1);
    setError(null);

    try {
      await operation();
      return true;
    } catch (error: unknown) {
      handleError(error, setError, setUnauthenticated);
      return false;
    } finally {
      setActiveMutations((current) => Math.max(0, current - 1));
    }
  }, []);

  const addTask = useCallback(async (input: NewTaskInput): Promise<boolean> => {
    let createdTask: Task | null = null;
    const succeeded = await runMutation(async () => {
      createdTask = await createTask(input);
    });

    if (succeeded && createdTask !== null) {
      const nextTask = createdTask;
      setTasks((current) => [...current, nextTask]);
    }

    return succeeded;
  }, [runMutation]);

  const removeTask = useCallback(async (id: string): Promise<boolean> => {
    const succeeded = await runMutation(() => deleteTask(id));

    if (succeeded) {
      setTasks((current) => current.filter((task) => task.id !== id));
    }

    return succeeded;
  }, [runMutation]);

  const retry = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  return {
    tasks,
    loading,
    busy: activeMutations > 0,
    error,
    unauthenticated,
    retry,
    addTask,
    removeTask,
  };
}

function handleError(
  error: unknown,
  setError: (message: string | null) => void,
  setUnauthenticated: (value: boolean) => void,
): void {
  if (error instanceof TaskApiError && error.status === 401) {
    setUnauthenticated(true);
    setError(null);
    return;
  }

  setError(
    error instanceof Error
      ? error.message
      : "Horizons could not complete that request. Try again.",
  );
}
