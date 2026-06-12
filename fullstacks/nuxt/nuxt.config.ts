import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const port = Number(process.env.PORT ?? 7178);

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  // 启用通用渲染（SSR）：读页（广场 / 胶囊详情）在服务端预渲染，首屏带数据、利于 SEO 与分享卡片。
  // 鉴权态存 localStorage（服务端读不到），故 auth 相关 UI 用 <ClientOnly> 隔离，避免 hydration mismatch。
  ssr: true,
  modules: ["@pinia/nuxt"],
  css: ["~/styles/index.css"],
  devServer: {
    host: "0.0.0.0",
    port,
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@spec": fileURLToPath(new URL("../../spec", import.meta.url)),
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  // 混合渲染：公开读页（广场 / 胶囊详情 / 关于）走 SSR；鉴权与强交互页面保持客户端渲染。
  // 后者依赖 localStorage 中的登录态（服务端读不到），SSR 既无 SEO 收益，还会让 auth 中间件
  // 在服务端把已登录用户误判为未登录、重定向到 /login。故显式标记为 SPA 孤岛。
  routeRules: {
    "/create": { ssr: false },
    "/me/**": { ssr: false },
  },
  nitro: {
    preset: "node-server",
  },
  // 全站默认 <title> 与 meta；SSR 页面可在组件内用 useHead() 覆盖为动态值（详情页、关于页等）。
  app: {
    head: {
      titleTemplate: "%s · HelloTime Pro",
      title: "HelloTime Pro",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "写一封信给未来的自己——多技术栈教学项目" },
      ],
    },
  },
});
