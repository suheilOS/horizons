import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";

const taskList = vi.hoisted(() => ({
  tasks: [],
  loading: false,
  busy: false,
  error: null,
  unauthenticated: false,
  retry: vi.fn(),
  refresh: vi.fn(),
  addTask: vi.fn(),
  removeTask: vi.fn(),
}));

vi.mock("../../src/useTaskList", () => ({
  useTaskList: () => taskList,
}));

let root: Root | null = null;

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function getElement<T extends Element>(selector: string, type: { new(): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing ${selector}.`);
  return element;
}

function enterText(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.set === undefined) throw new Error("Input value setter is unavailable.");
  descriptor.set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(createElement(App));
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("task entry progress", () => {
  it("shows progress, blocks duplicate submissions, and retains a failed draft", async () => {
    const addition = deferred<boolean>();
    taskList.addTask.mockReturnValue(addition.promise);
    const form = getElement(".task-entry", HTMLFormElement);
    const input = getElement(".task-entry__input", HTMLInputElement);

    await act(async () => {
      enterText(input, "Review the week");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(taskList.addTask).toHaveBeenCalledTimes(1);
    expect(form.getAttribute("aria-busy")).toBe("true");
    expect(input.readOnly).toBe(true);
    expect(form.querySelector(".task-entry__spinner")).not.toBeNull();
    expect(form.querySelector(".task-entry__plus")).toBeNull();

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(taskList.addTask).toHaveBeenCalledTimes(1);

    await act(async () => {
      addition.resolve(false);
      await addition.promise;
    });

    expect(form.getAttribute("aria-busy")).toBe("false");
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe("Review the week");
    expect(form.querySelector(".task-entry__spinner")).toBeNull();
    expect(form.querySelector(".task-entry__plus")).not.toBeNull();
  });
});
