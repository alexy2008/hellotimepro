import { mount } from "svelte";
import App from "./App.svelte";
import { wireAuthApi } from "./stores/auth.svelte.ts";
import "./styles/index.css";

// 把 auth store 注入到 api client（一次性配置）
wireAuthApi();

const target = document.getElementById("app");
if (!target) throw new Error("#app root element not found");

mount(App, { target });
