import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    // svelte-routing 只在 exports 里声明了 svelte 条件
    conditions: ["svelte", "browser"],
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
