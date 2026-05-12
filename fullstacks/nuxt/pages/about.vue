<script setup lang="ts">
import { computed } from "vue";
import { api } from "@/api/client";
import Alert from "@/components/Alert.vue";
import type { HealthData, StackItem } from "@/types";

const APP_STACK: StackItem[] = [
  { role: "framework", name: "Nuxt",         version: "3", iconUrl: "/static/icons/nuxt.svg" },
  { role: "view",      name: "Vue",          version: "3", iconUrl: "/static/icons/vue.svg" },
  { role: "language",  name: "TypeScript",   version: "5", iconUrl: "/static/icons/typescript.svg" },
  { role: "styling",   name: "Tailwind CSS", version: "4", iconUrl: "/static/icons/tailwindcss.svg" },
];

const APP_SUMMARY =
  "基于 Nuxt 3 pages/layouts 组织路由与页面，Vue 3 Composition API + <script setup> 聚合交互逻辑，" +
  "Pinia 管理 auth、theme、plaza 三个状态域，Nitro server/api 提供同源 REST 接口，" +
  "样式通过 Tailwind CSS v4 语义 token 统一约束。";

const { data: health, error } = await useAsyncData<HealthData>("health", () => api.health(), {
  server: false,
});
const errorText = computed(() => (error.value ? String(error.value) : null));

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

    <!-- 应用技术栈 -->
    <section style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        应用技术栈
      </h2>
      <div class="cy-card" style="padding: var(--space-6)">
        <!-- 图标行 -->
        <div style="display: flex; gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-4)">
          <div
            v-for="it in APP_STACK"
            :key="it.name"
            style="display: flex; flex-direction: column; align-items: center; gap: var(--space-1)"
          >
            <img v-if="it.iconUrl" :src="it.iconUrl" :alt="it.name" style="width: 48px; height: 48px" />
            <div v-else style="width: 48px; height: 48px; background: var(--color-surface-2); border-radius: var(--radius-md)" />
            <span style="font-size: var(--font-size-xs); color: var(--color-text-muted); font-family: var(--font-mono)">
              {{ it.name }}
            </span>
          </div>
        </div>
        <p style="margin: 0; color: var(--color-text-secondary); line-height: var(--line-height-relaxed)">
          {{ APP_SUMMARY }}
        </p>
      </div>
    </section>

    <!-- 服务端技术栈 -->
    <Alert v-if="errorText" variant="danger" style="margin-bottom: var(--space-6)">
      无法读取服务端信息：{{ errorText }}
    </Alert>

    <section v-if="health" style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        服务端技术栈
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
              {{ it.name }}
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
      <span>全栈：<code>Nuxt 3 + Nitro</code></span>
      <span>服务端：<code>{{ backendFramework }}</code></span>
      <span>License: MIT</span>
    </div>
  </main>
</template>
