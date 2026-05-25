import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@spec": path.resolve(__dirname, "../../spec"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: false,
  },
});
