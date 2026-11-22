import { fileURLToPath } from "node:url";
import { startupPreferences } from "./lib/preferences";

const spec = (path: string) => fileURLToPath(new URL(`../../spec/${path}`, import.meta.url));

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  modules: ["@pinia/nuxt"],
  css: ["~/styles/index.css"],
  alias: { "@spec": spec("") },
  components: false,
  devServer: { host: "0.0.0.0", port: Number(process.env.PORT ?? 7178) },
  typescript: { strict: true },
  routeRules: {
    "/create": { ssr: false },
    "/login": { ssr: false },
    "/register": { ssr: false },
    "/me": { ssr: false },
    "/me/**": { ssr: false },
  },
  nitro: {
    preset: "node-server",
    publicAssets: [
      { dir: spec("icons"), baseURL: "/static/icons" },
      { dir: spec("avatars/v2"), baseURL: "/static/avatars" },
    ],
  },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      titleTemplate: "%s · HelloTime Pro",
      title: "把此刻寄给未来",
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      meta: [
        { name: "description", content: "写一封信给未来的自己——多技术栈教学项目" },
        { name: "theme-color", content: "#080b1a" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
      script: [{ innerHTML: startupPreferences }],
    },
  },
});
