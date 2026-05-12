import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

const port = Number(process.env.PORT ?? 7178);

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  ssr: false,
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
  nitro: {
    preset: "node-server",
  },
});
