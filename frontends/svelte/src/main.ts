import { mount } from "svelte";
import App from "./App.svelte";
import { authStore, wireAuthApi } from "./stores/auth.svelte.ts";
import "./styles/index.css";

// 登录态在挂载之前从 localStorage 恢复：受保护页面与登录 / 注册页第一帧就能拿到正确的 user
authStore.hydrate();
// 把 auth store 注入到 api client（refresh 单飞、401 重放）
wireAuthApi();

const target = document.getElementById("app");
if (!target) throw new Error("#app root element not found");

mount(App, { target });
