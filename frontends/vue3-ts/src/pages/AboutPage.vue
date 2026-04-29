<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/api/client";
import Alert from "@/components/Alert.vue";
import type { HealthData } from "@/types";

const BACKENDS = [
  { name: "Spring Boot · Java", icon: "/static/icons/springboot.svg" },
  { name: "FastAPI · Python", icon: "/static/icons/fastapi.svg" },
  { name: "Gin · Go", icon: "/static/icons/gin.svg" },
  { name: "Elysia · Bun", icon: "/static/icons/elysia.svg" },
  { name: "NestJS · Node", icon: "/static/icons/nestjs.svg" },
  { name: "ASP.NET Core · C#", icon: "/static/icons/aspnet.svg" },
  { name: "Vapor · Swift", icon: "/static/icons/vapor.svg" },
  { name: "Axum · Rust", icon: "/static/icons/axum.svg" },
  { name: "Drogon · C++", icon: "/static/icons/drogon.svg" },
  { name: "Ktor · Kotlin", icon: "/static/icons/ktor.svg" },
];

const FRONTENDS = [
  { name: "Vue 3 (Composition)", icon: "/static/icons/vue.svg" },
  { name: "React 19", icon: "/static/icons/react.svg" },
  { name: "Angular 18", icon: "/static/icons/angular.svg" },
  { name: "Svelte 5", icon: "/static/icons/svelte.svg" },
  { name: "SolidJS", icon: "/static/icons/solidjs.svg" },
];

const FULLSTACKS = [
  { name: "Next.js · App Router", icon: "/static/icons/nextjs.svg" },
  { name: "Nuxt 3", icon: "/static/icons/nuxt.svg" },
  { name: "Spring MVC · Thymeleaf", icon: "/static/icons/springboot.svg" },
  { name: "Laravel · Blade", icon: "/static/icons/laravel.svg" },
  { name: "Rails · Hotwire", icon: "/static/icons/rails.svg" },
];

const health = ref<HealthData | null>(null);

onMounted(async () => {
  try {
    health.value = await api.health();
  } catch {
    /* noop */
  }
});

const currentBackend = computed(() => {
  const it = health.value?.stack.items.find((it) => it.role === "framework");
  return it?.name ?? "—";
});
const currentVersion = computed(() => health.value?.version ?? "—");
</script>

<template>
  <main
    class="cy-container cy-container--narrow"
    style="margin: var(--space-12) auto var(--space-16)"
  >
    <h1
      style="font-family: var(--font-display); font-size: var(--font-size-5xl); margin: 0 0 var(--space-4)"
    >
      关于
      <span
        style="background: var(--gradient-brand-hero); -webkit-background-clip: text; background-clip: text; color: transparent"
      >
        HelloTime Pro
      </span>
    </h1>
    <p
      style="color: var(--color-text-secondary); font-size: var(--font-size-lg); margin: 0 0 var(--space-10); line-height: var(--line-height-relaxed)"
    >
      这是一个<strong style="color: var(--color-text-primary)">多技术栈对比学习项目</strong> —— 同一款时光胶囊 Web 应用，
      由 10 个后端、5 个前端、5 个全栈框架各自独立实现一遍，像一张可切换的技术雷达。
    </p>

    <Alert variant="info" style="margin-bottom: var(--space-10)">
      当前页面是 <strong>Vue 3 前端实现</strong>。后端通过 :9080 反向代理动态切换，无需重启前端。
    </Alert>

    <section style="margin-bottom: var(--space-12)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        后端 10 栈
      </h2>
      <div
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-3)"
      >
        <div
          v-for="it in BACKENDS"
          :key="it.name"
          class="cy-stack__item"
          style="padding: var(--space-3); justify-content: flex-start"
        >
          <img :src="it.icon" alt="" /> {{ it.name }}
        </div>
      </div>
    </section>

    <section style="margin-bottom: var(--space-12)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        前端 5 栈
      </h2>
      <div
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-3)"
      >
        <div
          v-for="it in FRONTENDS"
          :key="it.name"
          class="cy-stack__item"
          style="padding: var(--space-3); justify-content: flex-start"
        >
          <img :src="it.icon" alt="" /> {{ it.name }}
        </div>
      </div>
    </section>

    <section style="margin-bottom: var(--space-12)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        全栈 5 框架
      </h2>
      <div
        style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-3)"
      >
        <div
          v-for="it in FULLSTACKS"
          :key="it.name"
          class="cy-stack__item"
          style="padding: var(--space-3); justify-content: flex-start"
        >
          <img :src="it.icon" alt="" /> {{ it.name }}
        </div>
      </div>
    </section>

    <div class="cy-card" style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-xl); margin: 0 0 var(--space-4)">
        三条硬约束
      </h2>
      <ul
        style="color: var(--color-text-secondary); margin: 0; padding-left: var(--space-5); line-height: var(--line-height-relaxed)"
      >
        <li>
          <strong style="color: var(--color-text-primary)">API 同源：</strong>所有后端实现同一份 <code>spec/api/openapi.yaml</code>。
        </li>
        <li>
          <strong style="color: var(--color-text-primary)">UI 同源：</strong>所有前端消费同一份 <code>spec/styles/tokens.css</code>。
        </li>
        <li>
          <strong style="color: var(--color-text-primary)">数据同源：</strong>所有后端兼容同一份 <code>spec/db/schema.sql</code>。
        </li>
      </ul>
    </div>

    <div
      style="padding: var(--space-4); border-top: 1px solid var(--color-border-subtle); color: var(--color-text-muted); font-size: var(--font-size-sm); display: flex; gap: var(--space-4); flex-wrap: wrap"
    >
      <span>当前后端: <code>{{ currentBackend }}</code></span>
      <span>后端版本: <code>{{ currentVersion }}</code></span>
      <span>License: MIT</span>
    </div>
  </main>
</template>
