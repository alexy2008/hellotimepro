<script lang="ts">
  import { api } from "@/api/client";
  import Alert from "@/components/Alert.svelte";
  import type { HealthData, StackItem } from "@/types";

  const FRONTEND_STACK: StackItem[] = [
    { role: "framework", name: "Svelte",       version: "5", iconUrl: "/static/icons/svelte.svg" },
    { role: "language",  name: "TypeScript",   version: "5", iconUrl: "/static/icons/typescript.svg" },
    { role: "styling",   name: "Tailwind CSS", version: "4", iconUrl: "/static/icons/tailwindcss.svg" },
  ];

  const FRONTEND_SUMMARY =
    "基于 Svelte 5 + TypeScript + Vite 核心骨架，选用 svelte-routing 控制路由，" +
    "基于原生 Runes Class Singletons 建立零依赖的状态管理，" +
    "Tailwind CSS v4 配合 Design Tokens 定制视觉系统。" +
    "利用 Svelte 5 革命性的 Runes 特性，通过编译期静态分析实现无虚拟 DOM 的极致运行效率与精确重绘，" +
    "配合 svelte-routing 的声明式跳转提供流畅的单页应用体验。" +
    "TypeScript 静态类型检查使前端数据结构与后端 OpenAPI 合约保持高度一致，" +
    "在编码阶段即可拦截绝大多数运行时异常。" +
    "Vite 基于原生 ESM 的极速热更新特性完美对接 Svelte 编译流程，输出极其轻量的静态资源。" +
    "摒弃繁重状态管理库，直接利用 $state 在标准类中声明响应式状态，" +
    "以模块化 class 单例暴露全局状态，在组件外的 API 请求库中也可优雅地读写。" +
    "设计令牌将颜色、字号等样式规范抽离为跨前端通用的 CSS 变量，" +
    "配合 Tailwind v4 使暗亮主题切换高效统一。";

  let health = $state<HealthData | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    api.health()
      .then((d) => { health = d; })
      .catch((e) => { error = String(e); });
  });

  const backendItems = $derived.by<StackItem[]>(() => {
    if (!health) return [];
    const order = ["framework", "language", "database"];
    return [...health.stack.items].sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
    );
  });

  const backendFramework = $derived(
    health?.stack.items.find((it) => it.role === "framework")?.name ?? "—",
  );
</script>

<main
  class="cy-container cy-container--narrow"
  style:margin="var(--space-12) auto var(--space-16)"
>
  <h1 style:font-family="var(--font-display)" style:font-size="var(--font-size-5xl)" style:margin="0 0 var(--space-3)">
    关于
    <span style:background="var(--gradient-brand-hero)" style:-webkit-background-clip="text" style:background-clip="text" style:color="transparent">
      HelloTime Pro
    </span>
  </h1>

  <p
    style:color="var(--color-text-secondary)"
    style:font-size="var(--font-size-lg)"
    style:line-height="var(--line-height-relaxed)"
    style:margin="0 0 var(--space-10)"
  >
    一款时光胶囊 Web 应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
    支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，
    同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。
  </p>

  <section style:margin-bottom="var(--space-10)">
    <h2 style:font-family="var(--font-display)" style:font-size="var(--font-size-2xl)" style:margin="0 0 var(--space-5)">
      前端技术栈
    </h2>
    <div class="cy-card" style:padding="var(--space-6)">
      <div style:display="flex" style:gap="var(--space-6)" style:flex-wrap="wrap" style:margin-bottom="var(--space-4)">
        {#each FRONTEND_STACK as it (it.name)}
          <div style:display="flex" style:flex-direction="column" style:align-items="center" style:gap="var(--space-1)">
            {#if it.iconUrl}
              <img src={it.iconUrl} alt={it.name} style:width="48px" style:height="48px" />
            {:else}
              <div style:width="48px" style:height="48px" style:background="var(--color-surface-2)" style:border-radius="var(--radius-md)"></div>
            {/if}
            <span style:font-size="var(--font-size-xs)" style:color="var(--color-text-muted)" style:font-family="var(--font-mono)">
              {it.name}{it.version ? ` ${it.version}` : ''}
            </span>
          </div>
        {/each}
      </div>
      <p style:margin="0" style:color="var(--color-text-secondary)" style:line-height="var(--line-height-relaxed)">
        {FRONTEND_SUMMARY}
      </p>
    </div>
  </section>

  {#if error}
    <Alert variant="danger">无法读取后端信息：{error}</Alert>
  {/if}

  {#if health}
    <section style:margin-bottom="var(--space-10)">
      <h2 style:font-family="var(--font-display)" style:font-size="var(--font-size-2xl)" style:margin="0 0 var(--space-5)">
        后端技术栈
      </h2>
      <div class="cy-card" style:padding="var(--space-6)">
        <div style:display="flex" style:gap="var(--space-6)" style:flex-wrap="wrap" style:margin-bottom="var(--space-4)">
          {#each backendItems as it (it.name)}
            <div style:display="flex" style:flex-direction="column" style:align-items="center" style:gap="var(--space-1)">
              {#if it.iconUrl}
                <img src={it.iconUrl} alt={it.name} style:width="48px" style:height="48px" />
              {:else}
                <div style:width="48px" style:height="48px" style:background="var(--color-surface-2)" style:border-radius="var(--radius-md)"></div>
              {/if}
              <span style:font-size="var(--font-size-xs)" style:color="var(--color-text-muted)" style:font-family="var(--font-mono)">
                {it.name}{it.version ? ` ${it.version}` : ''}
              </span>
            </div>
          {/each}
        </div>
        <p style:margin="0" style:color="var(--color-text-secondary)" style:line-height="var(--line-height-relaxed)">
          {health.stack.summary}
        </p>
      </div>
    </section>
  {/if}

  <div
    style:padding="var(--space-4) 0"
    style:border-top="1px solid var(--color-border-subtle)"
    style:color="var(--color-text-muted)"
    style:font-size="var(--font-size-sm)"
    style:display="flex"
    style:gap="var(--space-6)"
    style:flex-wrap="wrap"
  >
    <span>前端：<code>Svelte 5 + TypeScript</code></span>
    <span>后端：<code>{backendFramework}</code></span>
    <span>License: MIT</span>
  </div>
</main>
