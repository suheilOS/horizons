# Project Brief

## Overview

This project is a deliberately simple personal task app built around five time horizons:

- Today
- This Week
- This Month
- This Year
- Life

The goal is not to build a general-purpose productivity system. The app should provide a quiet place to write down what needs to be accomplished within each horizon, complete those tasks, and move on.

The defining behavior is that unfinished tasks expire when their time horizon ends.

---

## Product Principle

The column is the deadline.

Users should not need to:

- choose dates
- schedule tasks
- set reminders
- assign priorities
- create projects
- manage tags

A task belongs to one of five horizons, and that is enough information for the app to know how long it should remain.

The product should remain intentionally narrow. New features should only be added when they strengthen this core interaction.

---

## Core Horizons

### Today

Tasks remain available for the current calendar day.

An unfinished task expires once the day has ended.

### This Week

Tasks remain available for the current calendar week.

An unfinished task expires when that week has ended.

### This Month

Tasks remain available for the current calendar month.

An unfinished task expires when that month has ended.

### This Year

Tasks remain available for the current calendar year.

An unfinished task expires when that year has ended.

### Life

Tasks persist indefinitely until completed or manually deleted.

---

## Expiry Behavior

The app does not need background jobs, timers, notifications, or scheduled deletion.

Expiry should happen when the app loads or returns to the foreground.

For each task:

1. Determine the current period key for its horizon.
2. Compare it with the period key saved when the task was created.
3. Remove the task when the keys no longer match.

Example period keys:

```text
Today       → 2026-07-10
This Week   → 2026-W28
This Month  → 2026-07
This Year   → 2026
Life        → life
```

This keeps expiry logic simple and deterministic.

The implementation must define week boundaries consistently and test them explicitly.

---

## Core User Actions

Version 1 should support only the following actions:

1. Add a task to a horizon.
2. Mark a task as completed.
3. Delete a task manually.
4. Persist tasks locally.
5. Remove expired tasks automatically.
6. Use the app comfortably on desktop and mobile.

Completing a task should remove it from the active list.

A brief completion animation is acceptable, but completed-task history is outside the initial scope.

---

## Data Model

The task model should remain minimal.

```ts
type TaskHorizon = "today" | "week" | "month" | "year" | "life";

type Task = {
  id: string;
  text: string;
  horizon: TaskHorizon;
  periodKey: string;
  createdAt: string;
};
```

A persistent `completed` field is not required if completed tasks are immediately removed.

The exact schema may change slightly during implementation, but additional fields should only be introduced when required by real behavior.

---

## Persistence

Version 1 should use local browser storage only.

No backend is required.

Out of scope:

- authentication
- user accounts
- databases
- cloud sync
- server APIs
- cross-device synchronization

The app should work immediately when opened and retain valid tasks between sessions on the same browser.

Storage access should be isolated from presentation code so the persistence layer can be replaced later without rewriting the task interface.

---

## Interface Structure

### Desktop

The primary desktop layout contains five columns on one page:

```text
Today | This Week | This Month | This Year | Life
```

Each column should contain:

- its heading
- a quick task-entry control
- its active tasks
- task completion controls
- a minimal manual delete action

The layout should make all five horizons visible together on suitable desktop screens.

### Mobile

The app should not attempt to compress five narrow columns onto a small screen.

The mobile interface should allow the user to move horizontally between full-width horizon views.

A suitable direction is:

- horizontally scrollable horizons
- clear indication of the active horizon
- snap behavior between sections where appropriate
- the same task interaction model as desktop

The mobile experience should remain part of the same responsive interface rather than becoming a separate application flow.

---

## Visual Direction

The interface should feel quiet, soft, and functional.

### Typography

Use Open Runde as the primary typeface.

The font should be added locally to the project rather than depending on a third-party font CDN.

### General Direction

Prefer:

- generous whitespace
- soft neutral surfaces
- minimal borders
- subtle dividers
- restrained hover states
- rounded controls
- clear typography
- calm transitions

Avoid:

- excessive cards
- strong gradients
- productivity-dashboard aesthetics
- dense metadata
- decorative UI without a functional purpose

### Checkboxes

Task completion controls should use a rounded checkbox design.

The checkbox should be visually important enough to make task completion obvious without dominating the interface.

---

## Interaction Principles

### Adding tasks

Adding a task should require minimal friction.

The user should not have to open a modal or complete a form.

The ideal interaction is:

1. focus the add control
2. type the task
3. press Enter
4. continue

### Completing tasks

Completion should feel immediate.

A completed task may briefly transition into a checked or struck-through state before being removed.

The animation should not delay the user.

### Deleting tasks

Manual deletion should remain visually quiet.

On desktop, the action may appear on hover.

On touch devices, the control must remain discoverable and accessible without relying on hover.

---

## Accessibility

The simple visual design should not come at the cost of usability.

The implementation should include:

- semantic buttons and inputs
- keyboard-accessible task creation and completion
- visible focus states
- sufficient contrast
- accessible labels for icon-only actions
- reasonable touch target sizes

Custom checkboxes should preserve native checkbox semantics where practical.

---

## Explicitly Out of Scope

The initial project must not include:

- scheduling
- notifications
- reminders
- due-time selection
- calendars
- priorities
- tags
- projects
- subtasks
- notes
- recurring tasks
- task history
- analytics
- streaks
- gamification
- collaboration
- authentication
- cloud sync
- drag-and-drop between horizons

These should not be introduced during implementation unless the project brief is intentionally revised first.

---

## Technical Priorities

The implementation should prioritize:

1. Correct expiry behavior.
2. A small and understandable codebase.
3. Fast task entry and completion.
4. Reliable local persistence.
5. Strong responsive behavior.
6. Easy verification after each phase.

Abstraction should follow actual complexity rather than anticipating hypothetical future requirements.

---

## Delivery Approach

The project should be implemented in small, independently reviewable phases.

Each phase should:

- have one narrow goal
- make the smallest coherent change
- avoid work belonging to later phases
- be easy to inspect manually
- include validation before proceeding

A likely progression is:

### Phase 0 — Project foundation

Confirm the existing project setup, dependencies, font assets, and application shell.

### Phase 1 — Static interface

Build the five-horizon responsive layout without task behavior.

### Phase 2 — Core task interactions

Add creating, completing, and deleting tasks using in-memory state.

### Phase 3 — Local persistence

Persist and restore tasks from browser storage.

### Phase 4 — Expiry system

Implement period keys, stale-task cleanup, and boundary tests.

### Phase 5 — Responsive refinement

Complete the mobile horizon navigation and review interaction quality across screen sizes.

### Phase 6 — Final polish

Refine accessibility, transitions, empty states, and visual details without expanding scope.

These phases are a roadmap rather than permission to implement everything at once. Each implementation prompt should cover only the current phase.

---

## Definition of Done

The first version is complete when:

- all five horizons are available
- tasks can be added quickly
- tasks can be completed
- tasks can be manually deleted
- valid tasks persist after reload
- expired tasks disappear correctly
- Life tasks do not expire
- the interface works well on desktop and mobile
- Open Runde is used consistently
- the codebase contains no unnecessary backend or product complexity

The final result should feel finished precisely because it does very little.
