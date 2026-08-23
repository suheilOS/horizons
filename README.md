# Horizons

A minimalistic, time-horizon-based task management web application that helps you focus on what matters at different scales of time.

## Philosophy

Horizons is built on a rejection of the over-engineered, friction-heavy systems that dominate the modern productivity industry. It embraces two core principles:

- **A Clean Slate Daily:** Every morning is a fresh start. Stale, uncompleted tasks from yesterday do not roll over to clutter your day. Instead, the automatic lifecycle management gives you a clean slate, prompting you to intentionally decide what is important *today* and take immediate action.
- **Context, Not Complexity:** While the daily focus is a blank canvas, you don't drift. The cascading horizons (**Week**, **Month**, **Year**, and **Life**) sit right beside your day. Having your high-level objectives in sight keeps you aligned with your long-term direction without the weight of complex dashboards, tags, or project systems.

### Dependency Minimalism

To mirror this simplicity in the codebase, Horizons keeps the product surface small while using the platform services needed for account-backed sync:
- Synthesizes interactive sounds dynamically via the Web Audio API (zero audio files to download).
- Relies on pure, high-performance Vanilla CSS for layout and animations.
- Uses a small Hono Worker API with Cloudflare D1 for authenticated task storage.

## Features

- **Time-Horizon Columns:** Organize tasks by **Today**, **This Week**, **This Month**, **This Year**, and **Life**.
- **Automatic Lifecycle Management:** Stale tasks (outside their current time boundary) are automatically cleaned up when the app is opened or when visibility changes, keeping your focus sharp.
- **Audio Feedback:** Playful, built-in sound effects for adding, completing, and deleting tasks.
- **Dark/Light Mode:** Seamless persistent themes that adapt to system preferences.
- **Fully Accessible:** Crafted with semantic HTML, rich ARIA attributes, keyboard support, and `prefers-reduced-motion` compliance.
- **Account-backed Tasks:** Tasks sync through the shared Overhawl account; sound and theme preferences remain local to the browser.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Backend:** Hono on Cloudflare Workers
- **Storage:** Cloudflare D1, scoped by the authenticated Overhawl user
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

## Deployment

Horizons deploys as a full-stack [Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/) at `horizons.overhawl.app`. The Worker serves the Vite assets, authenticated task API, and a product-owned D1 database. It calls Overhawl Auth through a Service Binding.

Create the D1 database before the first deployment, then put its ID in `wrangler.jsonc`:

```bash
bunx wrangler d1 create horizons
```

Apply the schema locally or remotely with Wrangler's D1 migration commands:

```bash
bunx wrangler d1 migrations apply horizons --local
bunx wrangler d1 migrations apply horizons --remote
```

### Fully local browser testing

Run the local Auth Worker first in one terminal:

```bash
cd ../overhawl-auth
bun run migrate:local
bun run preview:cloudflare
```

It runs at `http://localhost:8788` with the local Auth D1 database.

Then run Horizons in a second terminal:

```bash
bun run migrate:local
bun run preview:local
```

Horizons runs at `http://localhost:8787`, uses local Horizons D1, and connects to the local Auth Worker through a local Service Binding. The local session cookie is shared between the two localhost ports.

For Vite HMR during local development, run `bun run dev` instead. It uses the same local Worker configuration and serves the app at `http://localhost:5173`.

### Production-like local preview

```bash
bun run preview:cloudflare
```

This uses local Horizons D1 but the deployed Auth Service, so it is useful for checking the production binding rather than for a fully local account flow.

### Validate the deployment

```bash
bun run deploy:check
```

The dry run builds the application and validates the Worker deployment without publishing it.

### Deploy manually

Authenticate once, then deploy:

```bash
bunx wrangler login
bun run deploy
```

The configured custom domain is required for the shared `overhawl.app` auth cookie. Do not use the `workers.dev` address as the production app URL.

### Deploy from Git

Cloudflare Workers Builds can deploy every push from GitHub or GitLab:

1. In **Workers & Pages**, select **Create application > Import a repository**.
2. Select the repository and keep the project root as the build root.
3. Set the build command to `bun run build`.
4. Set the deploy command to `bun run deploy`.
5. Make sure the Worker name is `horizons`, matching `wrangler.jsonc`.

Configure both commands in the Workers Builds Git workflow. The build command creates `dist`, and the deploy command publishes that output without rebuilding it.

### Browser preferences and task storage

Only the theme and sound preferences use browser storage. Tasks are authoritative on the authenticated API and are isolated by account. Each task stores the IANA timezone used to evaluate its horizon expiry.

## Project Structure

- [`src/App.tsx`](src/App.tsx): Main React UI component and state coordination.
- [`shared/task.ts`](shared/task.ts): Shared task contracts and runtime validation.
- [`shared/task-periods.ts`](shared/task-periods.ts): Timezone-aware period calculations and expiry checks.
- [`src/taskApi.ts`](src/taskApi.ts): Authenticated client for the task API.
- [`src/useTaskList.ts`](src/useTaskList.ts): Server-backed task loading and mutations.
- [`worker/`](worker/): Hono Worker, auth middleware, CSRF protection, and task routes.
- [`migrations/`](migrations/): D1 schema migrations.
- [`src/sound.ts`](src/sound.ts): Web Audio API synthesizer for interactive UI sounds.
- [`src/styles.css`](src/styles.css): Complete themeable CSS layout, animations, and transitions.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
