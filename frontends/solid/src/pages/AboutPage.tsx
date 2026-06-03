import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "@/api/client";
import { Alert } from "@/components/Alert";
import type { HealthData, StackItem } from "@/types";

const FRONTEND_STACK: StackItem[] = [
  { role: "framework", name: "SolidJS", version: "1", iconUrl: "/static/icons/solidjs.svg" },
  { role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" },
  { role: "styling", name: "Tailwind CSS", version: "4", iconUrl: "/static/icons/tailwindcss.svg" },
];

const FRONTEND_SUMMARY =
  "基于 SolidJS + TypeScript + Vite 核心骨架，选用 @solidjs/router 控制路由与守卫机制，" +
  "用模块级 Signals / Store 做轻量状态管理，Tailwind CSS v4 配合 Design Tokens 定制视觉系统。" +
  "SolidJS 最大的特色是细粒度响应式：组件函数只运行一次，JSX 被编译为直接的 DOM 操作，" +
  "状态读取（如 count()）在哪里使用，更新就只精准刷新那一处，没有虚拟 DOM diff 的开销。" +
  "createSignal / createStore / createResource 构成一套以「订阅」为核心的响应式原语，" +
  "状态可脱离组件树存在于模块顶层，任意组件读取即建立订阅，便于跨组件共享。" +
  "TypeScript 静态类型检查使前端数据结构与后端 OpenAPI 合约保持高度一致，" +
  "在编码阶段即可拦截绝大多数运行时异常。" +
  "Vite 基于原生 ESM 的极速热更新特性实现代码改动的即时响应，大幅提升开发效率。" +
  "设计令牌将颜色、字号等样式规范抽离为跨前端通用的 CSS 变量，" +
  "配合 Tailwind v4 使暗亮主题切换高效统一。";

function IconRow(props: { items: StackItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-6)",
        "flex-wrap": "wrap",
        "margin-bottom": "var(--space-4)",
      }}
    >
      <For each={props.items}>
        {(it) => (
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "var(--space-1)",
            }}
          >
            <Show
              when={it.iconUrl}
              fallback={
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    background: "var(--color-surface-2)",
                    "border-radius": "var(--radius-md)",
                  }}
                />
              }
            >
              <img src={it.iconUrl!} alt={it.name} style={{ width: "48px", height: "48px" }} />
            </Show>
            <span
              style={{
                "font-size": "var(--font-size-xs)",
                color: "var(--color-text-muted)",
                "font-family": "var(--font-mono)",
              }}
            >
              {it.name}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

export function AboutPage() {
  const [health, setHealth] = createSignal<HealthData | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    api
      .health()
      .then((d) => setHealth(d))
      .catch((e) => setError(String(e)));
  });

  const backendItems = () => {
    const h = health();
    if (!h) return [] as StackItem[];
    const order = ["framework", "language", "database"];
    return [...h.stack.items].sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
    );
  };

  const backendFramework = () =>
    health()?.stack.items.find((it) => it.role === "framework")?.name ?? "—";

  return (
    <main
      class="cy-container cy-container--narrow"
      style={{ margin: "var(--space-12) auto var(--space-16)" }}
    >
      <h1
        style={{
          "font-family": "var(--font-display)",
          "font-size": "var(--font-size-5xl)",
          margin: "0 0 var(--space-3)",
        }}
      >
        关于{" "}
        <span
          style={{
            background: "var(--gradient-brand-hero)",
            "-webkit-background-clip": "text",
            "background-clip": "text",
            color: "transparent",
          }}
        >
          HelloTime Pro
        </span>
      </h1>

      <p
        style={{
          color: "var(--color-text-secondary)",
          "font-size": "var(--font-size-lg)",
          "line-height": "var(--line-height-relaxed)",
          margin: "0 0 var(--space-10)",
        }}
      >
        一款时光胶囊 Web 应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
        支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，
        同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。
      </p>

      <section style={{ "margin-bottom": "var(--space-10)" }}>
        <h2
          style={{
            "font-family": "var(--font-display)",
            "font-size": "var(--font-size-2xl)",
            margin: "0 0 var(--space-5)",
          }}
        >
          前端技术栈
        </h2>
        <div class="cy-card" style={{ padding: "var(--space-6)" }}>
          <IconRow items={FRONTEND_STACK} />
          <p
            style={{
              margin: "0",
              color: "var(--color-text-secondary)",
              "line-height": "var(--line-height-relaxed)",
            }}
          >
            {FRONTEND_SUMMARY}
          </p>
        </div>
      </section>

      <Show when={error()}>
        <Alert variant="danger" style={{ "margin-bottom": "var(--space-6)" }}>
          无法读取后端信息：{error()}
        </Alert>
      </Show>
      <Show when={health()}>
        {(h) => (
          <section style={{ "margin-bottom": "var(--space-10)" }}>
            <h2
              style={{
                "font-family": "var(--font-display)",
                "font-size": "var(--font-size-2xl)",
                margin: "0 0 var(--space-5)",
              }}
            >
              后端技术栈
            </h2>
            <div class="cy-card" style={{ padding: "var(--space-6)" }}>
              <IconRow items={backendItems()} />
              <p
                style={{
                  margin: "0",
                  color: "var(--color-text-secondary)",
                  "line-height": "var(--line-height-relaxed)",
                }}
              >
                {h().stack.summary}
              </p>
            </div>
          </section>
        )}
      </Show>

      <div
        style={{
          padding: "var(--space-4) 0",
          "border-top": "1px solid var(--color-border-subtle)",
          color: "var(--color-text-muted)",
          "font-size": "var(--font-size-sm)",
          display: "flex",
          gap: "var(--space-6)",
          "flex-wrap": "wrap",
        }}
      >
        <span>
          前端：<code>SolidJS + TypeScript</code>
        </span>
        <span>
          后端：<code>{backendFramework()}</code>
        </span>
        <span>License: MIT</span>
      </div>
    </main>
  );
}
