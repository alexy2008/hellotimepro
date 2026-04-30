<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/api/client";
import Alert from "@/components/Alert.vue";
import type { HealthData, StackItem } from "@/types";
import techMetaRaw from "@spec/tech-meta.json";

const techMeta = techMetaRaw as Record<string, { tagline: string; features: string[] }>;

function withMeta(item: Omit<StackItem, "tagline" | "features">): StackItem {
  const m = techMeta[item.name];
  return { ...item, tagline: m?.tagline ?? null, features: m?.features ?? null };
}

const ROLE_LABEL: Record<string, string> = {
  language: "语言",
  framework: "框架",
  database: "数据库",
  runtime: "运行时",
  styling: "样式",
  template: "模板引擎",
};

const FRONTEND_STACK: StackItem[] = [
  withMeta({ role: "framework", name: "Vue", version: "3", iconUrl: "/static/icons/vue.svg" }),
  withMeta({ role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" }),
  withMeta({
    role: "styling",
    name: "Tailwind CSS",
    version: "4",
    iconUrl: "/static/icons/tailwindcss.svg",
  }),
];

const health = ref<HealthData | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    health.value = await api.health();
  } catch (e) {
    error.value = String(e);
  }
});

const backendItems = computed<StackItem[]>(() => {
  if (!health.value) return [];
  const order = ["framework", "language", "database", "styling", "runtime", "template"];
  return [...health.value.stack.items].sort(
    (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
  );
});

const backendKind = computed(() =>
  health.value?.stack.kind === "fullstack" ? "全栈" : "后端",
);

const currentBackend = computed(
  () => health.value?.stack.items.find((it) => it.role === "framework")?.name ?? "—",
);
const currentVersion = computed(() => health.value?.version ?? "—");

function roleLabelOf(role: string): string {
  return ROLE_LABEL[role] ?? role;
}
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
      style="color: var(--color-text-secondary); font-size: var(--font-size-lg); margin: 0 0 var(--space-8); line-height: var(--line-height-relaxed)"
    >
      多技术栈对比学习项目 —— 同一款时光胶囊 Web 应用，由若干前后端框架各自实现一遍。
      本页只介绍<strong style="color: var(--color-text-primary)">当前正在运行的这一组栈</strong>，
      后端信息从 <code>/api/v1/health</code> 实时上报。
    </p>

    <Alert variant="info" style="margin-bottom: var(--space-10)">
      当前前端是 <strong>Vue 3 + TypeScript</strong> 实现；后端通过 <code>:9080</code> 反向代理动态切换，无需重启前端。
    </Alert>

    <!-- 前端栈 -->
    <section style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        前端栈
      </h2>
      <div style="display: grid; gap: var(--space-4)">
        <div
          v-for="item in FRONTEND_STACK"
          :key="`${item.role}-${item.name}`"
          class="cy-card"
          style="display: flex; gap: var(--space-6); align-items: flex-start; padding: var(--space-6)"
        >
          <div
            style="width: 88px; height: 88px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--color-surface-2); border-radius: var(--radius-lg); border: 1px solid var(--color-border-subtle)"
          >
            <img
              v-if="item.iconUrl"
              :src="item.iconUrl"
              :alt="item.name"
              style="width: 60px; height: 60px"
            />
            <span v-else style="font-size: var(--font-size-2xl); color: var(--color-text-muted)">·</span>
          </div>
          <div style="flex: 1; min-width: 0">
            <div
              style="display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2)"
            >
              <h3 style="font-family: var(--font-display); font-size: var(--font-size-xl); margin: 0; color: var(--color-text-primary)">
                {{ item.name }}
              </h3>
              <span style="font-family: var(--font-mono); font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-surface-2); color: var(--color-brand-primary); border: 1px solid var(--color-border-subtle)">
                v{{ item.version }}
              </span>
              <span style="font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-surface-2); color: var(--color-text-muted)">
                {{ roleLabelOf(item.role) }}
              </span>
            </div>
            <p
              v-if="item.tagline"
              style="color: var(--color-text-secondary); margin: 0 0 var(--space-3); line-height: var(--line-height-relaxed)"
            >
              {{ item.tagline }}
            </p>
            <ul
              v-if="item.features?.length"
              style="margin: 0; padding-left: var(--space-5); list-style: disc; color: var(--color-text-secondary); line-height: var(--line-height-relaxed); font-size: var(--font-size-sm)"
            >
              <li v-for="f in item.features" :key="f">{{ f }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <Alert v-if="error" variant="danger" style="margin-bottom: var(--space-6)">
      无法读取后端 /health 信息：{{ error }}
    </Alert>

    <!-- 后端栈 -->
    <section v-if="health" style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-2xl); margin: 0 0 var(--space-5)">
        {{ backendKind }}栈 · {{ health.service }} v{{ health.version }}
      </h2>
      <div style="display: grid; gap: var(--space-4)">
        <div
          v-for="item in backendItems"
          :key="`${item.role}-${item.name}`"
          class="cy-card"
          style="display: flex; gap: var(--space-6); align-items: flex-start; padding: var(--space-6)"
        >
          <div
            style="width: 88px; height: 88px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--color-surface-2); border-radius: var(--radius-lg); border: 1px solid var(--color-border-subtle)"
          >
            <img
              v-if="item.iconUrl"
              :src="item.iconUrl"
              :alt="item.name"
              style="width: 60px; height: 60px"
            />
            <span v-else style="font-size: var(--font-size-2xl); color: var(--color-text-muted)">·</span>
          </div>
          <div style="flex: 1; min-width: 0">
            <div
              style="display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-2)"
            >
              <h3 style="font-family: var(--font-display); font-size: var(--font-size-xl); margin: 0; color: var(--color-text-primary)">
                {{ item.name }}
              </h3>
              <span style="font-family: var(--font-mono); font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-surface-2); color: var(--color-brand-primary); border: 1px solid var(--color-border-subtle)">
                v{{ item.version }}
              </span>
              <span style="font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--radius-full); background: var(--color-surface-2); color: var(--color-text-muted)">
                {{ roleLabelOf(item.role) }}
              </span>
            </div>
            <p
              v-if="item.tagline"
              style="color: var(--color-text-secondary); margin: 0 0 var(--space-3); line-height: var(--line-height-relaxed)"
            >
              {{ item.tagline }}
            </p>
            <ul
              v-if="item.features?.length"
              style="margin: 0; padding-left: var(--space-5); list-style: disc; color: var(--color-text-secondary); line-height: var(--line-height-relaxed); font-size: var(--font-size-sm)"
            >
              <li v-for="f in item.features" :key="f">{{ f }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <div class="cy-card" style="margin-bottom: var(--space-10)">
      <h2 style="font-family: var(--font-display); font-size: var(--font-size-xl); margin: 0 0 var(--space-4)">
        三条硬约束
      </h2>
      <ul style="color: var(--color-text-secondary); margin: 0; padding-left: var(--space-5); list-style: disc; line-height: var(--line-height-relaxed)">
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
