import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { useAuthStore, wireAuthApi } from "./stores/auth";
import "./styles/index.css";

const app = createApp(App);
app.use(createPinia());

// 登录态在装路由之前从 localStorage 恢复：首次导航的守卫（未登录跳登录、
// 已登录访问登录 / 注册页跳走）第一帧就能拿到正确的 user
useAuthStore().hydrate();
// 把 auth store 注入到 api client（refresh 单飞、401 重放）
wireAuthApi();

app.use(router);
app.mount("#app");
