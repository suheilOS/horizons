# Horizons

A minimalistic, time-horizon-based task management web application that helps you focus on what matters at different scales of time.

## Philosophy

Horizons is built on a rejection of the over-engineered, friction-heavy systems that dominate the modern productivity industry. It embraces two core principles:

- **A Clean Slate Daily:** Every morning is a fresh start. Stale, uncompleted tasks from yesterday do not roll over to clutter your day. Instead, the automatic lifecycle management gives you a clean slate, prompting you to intentionally decide what is important *today* and take immediate action.
- **Context, Not Complexity:** While the daily focus is a blank canvas, you don't drift. The cascading horizons (**Week**, **Month**, **Year**, and **Life**) sit right beside your day. Having your high-level objectives in sight keeps you aligned with your long-term direction without the weight of complex dashboards, databases, or tags.

### Dependency Minimalism

To mirror this simplicity in the codebase, Horizons enforces a strict minimal-dependency architecture. The application operates almost entirely on native web standards:
- Synthesizes interactive sounds dynamically via the Web Audio API (zero audio files to download).
- Relies on pure, high-performance Vanilla CSS for layout and animations.
- Keeps external dependencies limited strictly to React, TypeScript, Vite, and the `@fontsource/open-runde` typeface.

## Features

- **Time-Horizon Columns:** Organize tasks by **Today**, **This Week**, **This Month**, **This Year**, and **Life**.
- **Automatic Lifecycle Management:** Stale tasks (outside their current time boundary) are automatically cleaned up when the app is opened or when visibility changes, keeping your focus sharp.
- **Audio Feedback:** Playful, built-in sound effects for adding, completing, and deleting tasks.
- **Dark/Light Mode:** Seamless persistent themes that adapt to system preferences.
- **Fully Accessible:** Crafted with semantic HTML, rich ARIA attributes, keyboard support, and `prefers-reduced-motion` compliance.
- **Local Storage Persistence:** All tasks and settings are persisted locally in your browser.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Bundler:** Vite
- **Styling:** CSS3 (Vanilla)
- **Audio:** Web Audio API (In-memory synthesized sound effects)
- **Package Manager:** Bun (lockfile included)

## Getting Started

### Prerequisites

You need [Bun](https://bun.sh/) installed on your system.

### Installation

1. Install the dependencies:
   ```bash
   bun install
   ```

2. Run the development server:
   ```bash
   bun run dev
   ```

3. Build for production:
   ```bash
   bun run build
   ```

## Project Structure

- [`src/App.tsx`](file:///home/suheil/Documents/Dev/experiments/horizons/src/App.tsx): Main React UI component and state coordination.
- [`src/task.ts`](file:///home/suheil/Documents/Dev/experiments/horizons/src/task.ts): Types for tasks and time horizons.
- [`src/taskPeriods.ts`](file:///home/suheil/Documents/Dev/experiments/horizons/src/taskPeriods.ts): Calculations for period keys (ISO week, year, month, etc.) and checking task currency.
- [`src/taskStorage.ts`](file:///home/suheil/Documents/Dev/experiments/horizons/src/taskStorage.ts): `localStorage` synchronization and version migration.
- [`src/sound.ts`](file:///home/suheil/Documents/Dev/experiments/horizons/src/sound.ts): Web Audio API synthesizer for interactive UI sounds.
- [`src/styles.css`](file:///home/suheil/Documents/Dev/experiments/horizons/src/styles.css): Complete themeable CSS layout, animations, and transitions.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
