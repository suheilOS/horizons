import { Hono } from "hono";
import type { AppEnv } from "./auth";
import { requireSameOrigin } from "./csrf";
import { handleSignOut } from "./sign-out";
import { jsonError } from "./http";
import { taskRoutes } from "./tasks";

export const app = new Hono<AppEnv>();

app.get("/health", (context) => context.json({ status: "ok" }));
app.post("/api/auth/sign-out", requireSameOrigin, handleSignOut);
app.all("/api/auth/sign-out", () => jsonError({
  error: {
    code: "method_not_allowed",
    message: "Use POST to sign out.",
  },
}, 405, { Allow: "POST" }));
app.route("/api", taskRoutes);

app.all("/api/*", () => jsonError({
  error: {
    code: "not_found",
    message: "The requested API route does not exist.",
  },
}, 404));

app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));

app.onError((error, context) => {
  console.error(JSON.stringify({
    message: "Horizons Worker request failed",
    path: new URL(context.req.raw.url).pathname,
    error: error instanceof Error ? error.message : String(error),
  }));

  return jsonError({
    error: {
      code: "internal_error",
      message: "The request could not be completed.",
    },
  }, 500);
});

export default app;
