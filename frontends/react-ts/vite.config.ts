import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// 反向代理目标：默认指向 :9080（hello switch 切换的反代）
// 也可以直连某后端，例如 BACKEND_PROXY=http://localhost:29010
const BACKEND_PROXY = process.env.BACKEND_PROXY ?? "http://localhost:9080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@spec": path.resolve(__dirname, "../../spec"),
    },
  },
  server: {
    port: 7174,
    host: "0.0.0.0",
    proxy: {
      // API 与后端静态资源（头像 / 图标）一并代理
      "/api": { target: BACKEND_PROXY, changeOrigin: true },
      "/static": { target: BACKEND_PROXY, changeOrigin: true },
    },
  },
});
