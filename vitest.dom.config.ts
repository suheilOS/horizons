import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "https://horizons.test/" },
    },
    setupFiles: ["./tests/browser/setup.ts"],
    include: ["tests/browser/**/*.test.ts"],
  },
});
