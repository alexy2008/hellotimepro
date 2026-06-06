<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/api/client";
import Alert from "@/components/Alert.vue";
import type { HealthData, StackItem } from "@/types";

const FRONTEND_STACK: StackItem[] = [
  { role: "framework", name: "Vue",          version: "3", iconUrl: "/static/icons/vue.svg" },
  { role: "language",  name: "TypeScript",   version: "5", iconUrl: "/static/icons/typescript.svg" },
  { role: "styling",   name: "Tailwind CSS", version: "4", iconUrl: "/static/icons/tailwindcss.svg" },
];

const FRONTEND_SUMMARY =
  "基于 Vue 3 + TypeScript + Vite 核心骨架，选用 Vue Router 控制路由与全局守卫，" +
  "Pinia 进行轻量级状态管理，Tailwind CSS v4 配合 Design Tokens 定制视觉系统。" +
  "利用 Vue 3 Composition API 和细粒度响应式系统实现更直观的逻辑复用，" +
  "配合 Vue Router 的嵌套路由与导航守卫，" +
  "用户切换页面时无需刷新浏览器即可获得流畅的单页应用体验。" +
  "TypeScript 静态类型检查使前端数据结构与后端 OpenAPI 合约保持高度一致，" +
  "在编码阶段即可拦截绝大多数运行时异常。" +
  "Vite 基于原生 ESM 的极速热更新特性实现代码改动的即时响应，大幅提升开发效率。" +
  "Pinia 以 setup 风格和直接突变的 action 机制完美契合 Vue 3 的心智模型，" +
  "同时极易在组件外部调用。" +
  "设计令牌将颜色、字号等样式规范抽离为跨前端通用的 CSS 变量，" +
  "配合 Tailwind v4 使暗亮主题切换高效统一。";

const health = ref<HealthData | null>(null);
const error = ref<string | null>(null);

onMounted(() => {
  api.health()
    .then((d) => { health.value = d; })
    .catch((e) => { error.value = String(e); });
});

const backendItems = computed<StackItem[]>(() => {
  if (!health.value) return [];
  const order = ["framework", "language", "database"];
  return [...health.value.stack.items].sort(
    (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
  );
});

const backendFramework = computed(
  () => health.value?.stack.items.find((it) => it.role === "framework")?.name ?? "—",
);
</script>

<template>
  <main
    class="cy-container cy-container--narrow"
    style="margin: var(--space-12) auto var(--space-16)"
  >
    <!-- 标题 -->
    <h1 style="font-family: var(--font-display); font-size: var(--font-size-5xl); margin: 0 0 var(--space-3)">
      关于
      <span style="background: var(--gradient-brand-hero); -webkit-background-clip: text; background-clip: text; color: transparent">
        HelloTime Pro
      </span>
    </h1>

    <!-- 产品简介 -->
    <p style="color: var(--color-text-secondary); font-size: var(--font-size-lg); line-height: var(--line-height-relaxed); margin: 0 0 var(--space-10)">
      一款时光胶囊 Web 应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
      支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，
      同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。
    </p>

    <!-- 前端技术栈 -->
    <section style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        前端技术栈
      </h2>
      <div class="cy-card" style="padding: var(--space-6)">
        <!-- 图标行 -->
        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-4)">
          <div
            v-for="it in FRONTEND_STACK"
            :key="it.name"
            style="display: flex; flex-direction: column; align-items: center; gap: var(--space-1)"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" style="width: 48px; height: 48px" />
            <div v-else style="width: 48px; height: 48px; background: var(--color-surface-2); border-radius: var(--radius-md)" />
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-family: var(--font-mono)">
              {{ it.name }}{{ it.version ? ` ${it.version}` : '' }}
            </span>
          </div>
        </div>
        <p style="margin: 0; color: var(--color-text-secondary); line-height: var(--line-height-relaxed)">
          {{ FRONTEND_SUMMARY }}
        </p>
      </div>
    </section>

    <!-- 后端技术栈 -->
    <Alert v-if="error" variant="danger" style="margin-bottom: var(--space-6)">
      无法读取后端信息：{{ error }}
    </Alert>

    <section v-if="health" style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        后端技术栈
      </h2>
      <div class="cy-card" style="padding: var(--space-6)">
        <!-- 图标行（动态） -->
        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-4)">
          <div
            v-for="it in backendItems"
            :key="it.name"
            style="display: flex; flex-direction: column; align-items: center; gap: var(--space-1)"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" style="width: 48px; height: 48px" />
            <div v-else style="width: 48px; height: 48px; background: var(--color-surface-2); border-radius: var(--radius-md)" />
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-family: var(--font-mono)">
              {{ it.name }}{{ it.version ? ` ${it.version}` : '' }}
            </span>
          </div>
        </div>
        <p style="margin: 0; color: var(--color-text-secondary); line-height: var(--line-height-relaxed)">
          {{ health.stack.summary }}
        </p>
      </div>
    </section>

    <!-- 底部元信息 -->
    <div style="padding: var(--space-4) 0; border-top: 1px solid var(--color-border-subtle); color: var(--color-text-muted); font-size: var(--font-size-sm); display: flex; gap: var(--space-6); flex-wrap: wrap">
      <span>前端：<code>Vue 3 + TypeScript</code></span>
      <span>后端：<code>{{ backendFramework }}</code></span>
      <span>License: MIT</span>
    </div>
  </main>
</template>
