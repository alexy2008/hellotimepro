import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { wireAuthApi } from "./stores/auth";
import "./styles/index.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
// Pinia 初始化后再把 auth store 注入到 api client
wireAuthApi();
app.mount("#app");
