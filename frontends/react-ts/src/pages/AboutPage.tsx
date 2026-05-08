import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Alert } from "@/components/Alert";
import type { HealthData, StackItem } from "@/types";

const FRONTEND_STACK: StackItem[] = [
  { role: "framework", name: "React",        version: "19", iconUrl: "/static/icons/react.svg" },
  { role: "language",  name: "TypeScript",   version: "5",  iconUrl: "/static/icons/typescript.svg" },
  { role: "styling",   name: "Tailwind CSS", version: "4",  iconUrl: "/static/icons/tailwindcss.svg" },
];

const FRONTEND_SUMMARY =
  "基于 React 19 + TypeScript 5 构建，全组件 Hooks 驱动，React Router v6 处理路由，" +
  "AuthContext 管理 JWT 令牌内存存储与自动刷新，样式通过 Tailwind CSS v4 语义 token 统一约束。";

function IconRow({ items }: { items: StackItem[] }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
      {items.map((it) => (
        <div key={it.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
          {it.iconUrl ? (
            <img src={it.iconUrl} alt={it.name} style={{ width: 48, height: 48 }} />
          ) : (
            <div style={{ width: 48, height: 48, background: "var(--color-surface-2)", borderRadius: "var(--radius-md)" }} />
          )}
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {it.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AboutPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.health()
      .then((d) => { if (active) setHealth(d); })
      .catch((e) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, []);

  const backendItems = health
    ? [...health.stack.items].sort((a, b) => {
        const order = ["framework", "language", "database"];
        return order.indexOf(a.role) - order.indexOf(b.role);
      })
    : [];

  const backendFramework = health?.stack.items.find((it) => it.role === "framework")?.name ?? "—";

  return (
    <main
      className="cy-container cy-container--narrow"
      style={{ margin: "var(--space-12) auto var(--space-16)" }}
    >
      {/* 标题 */}
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-5xl)", margin: "0 0 var(--space-3)" }}>
        关于{" "}
        <span style={{ background: "var(--gradient-brand-hero)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          HelloTime Pro
        </span>
      </h1>

      {/* 产品简介 */}
      <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-relaxed)", margin: "0 0 var(--space-10)" }}>
        一款时光胶囊 Web 应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
        支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，
        同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。
      </p>

      {/* 前端技术栈 */}
      <section style={{ marginBottom: "var(--space-10)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-2xl)", margin: "0 0 var(--space-5)" }}>
          前端技术栈
        </h2>
        <div className="cy-card" style={{ padding: "var(--space-6)" }}>
          <IconRow items={FRONTEND_STACK} />
          <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: "var(--line-height-relaxed)" }}>
            {FRONTEND_SUMMARY}
          </p>
        </div>
      </section>

      {/* 后端技术栈 */}
      {error && (
        <Alert variant="danger" style={{ marginBottom: "var(--space-6)" }}>
          无法读取后端信息：{error}
        </Alert>
      )}
      {health && (
        <section style={{ marginBottom: "var(--space-10)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-2xl)", margin: "0 0 var(--space-5)" }}>
            后端技术栈
          </h2>
          <div className="cy-card" style={{ padding: "var(--space-6)" }}>
            <IconRow items={backendItems} />
            <p style={{ margin: 0, color: "var(--color-text-secondary)", lineHeight: "var(--line-height-relaxed)" }}>
              {health.stack.summary}
            </p>
          </div>
        </section>
      )}

      {/* 底部元信息 */}
      <div style={{ padding: "var(--space-4) 0", borderTop: "1px solid var(--color-border-subtle)", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <span>前端：<code>React + TypeScript</code></span>
        <span>后端：<code>{backendFramework}</code></span>
        <span>License: MIT</span>
      </div>
    </main>
  );
}
