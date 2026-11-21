import { render } from "solid-js/web";
import { App } from "./App";
import { hydrateAuth } from "@/stores/auth";
import "./styles/index.css";

// 登录态在首次渲染之前从 localStorage 恢复：
// 守卫（未登录跳登录、已登录访问登录 / 注册页跳走）在第一帧就能拿到正确的 user
hydrateAuth();

render(() => <App />, document.getElementById("root")!);
