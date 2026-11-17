import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useAuth } from "@/stores/auth";
import "./styles/index.css";

// 登录态在首次渲染之前从 localStorage 恢复：
// 守卫（未登录跳登录、已登录访问登录 / 注册页跳走）在第一帧就能拿到正确的 user
useAuth.getState().hydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
