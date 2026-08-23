import { Hono } from "hono";
import type { AppEnv } from "./auth";
import { taskRoutes } from "./tasks";

export const app = new Hono<AppEnv>();

app.get("/health", (context) => context.json({ status: "ok" }));
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

function jsonError(
  body: { error: { code: string; message: string } },
  status: number,
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
