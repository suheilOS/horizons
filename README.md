# Horizons

A minimalistic, time-horizon-based task management web application that helps you focus on what matters at different scales of time.

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
