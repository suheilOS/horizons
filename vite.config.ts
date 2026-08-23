import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    cloudflare({
      configPath:
        command === "serve" ? "./wrangler.local.jsonc" : "./wrangler.jsonc",
    }),
  ],
}));
