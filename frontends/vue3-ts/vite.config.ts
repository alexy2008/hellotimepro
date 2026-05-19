import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// 反向代理目标：默认指向 :9080（hello switch 切换的反代）
// 也可以直连某后端，例如 BACKEND_PROXY=http://localhost:29010
const BACKEND_PROXY = process.env.BACKEND_PROXY ?? "http://localhost:9080";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@spec": path.resolve(__dirname, "../../spec"),
    },
  },
  server: {
    port: 7173,
    host: "0.0.0.0",
    proxy: {
      // API 与后端静态资源（头像 / 图标）一并代理
      // proxyTimeout 延长至 60s，以容纳 LLM 胶囊建议接口的响应时间
      "/api": { target: BACKEND_PROXY, changeOrigin: true, proxyTimeout: 60_000 },
      "/static": { target: BACKEND_PROXY, changeOrigin: true },
    },
  },
});
