import { defineConfig } from "vitest/config";
import path from "node:path";

// 单元测试只覆盖纯函数（utils/format）与 API 客户端（fetch mock），
// 不渲染 Solid 组件，因此无需 vite-plugin-solid，用最轻的 node 环境即可。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@spec": path.resolve(__dirname, "../../spec"),
    },
  },
  test: {
    environment: "node",
    globals: false,
  },
});
