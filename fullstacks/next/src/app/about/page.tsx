"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Alert } from "@/components/alert";
import type { HealthData, StackItem } from "@/types";

const FRONTEND_STACK: StackItem[] = [
  { role: "framework", name: "Next.js", version: "15", iconUrl: "/static/icons/nextjs.svg" },
  { role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" },
  { role: "library", name: "React", version: "19", iconUrl: "/static/icons/react.svg" },
];

const FRONTEND_SUMMARY =
  "Next.js 15 App Router + React 19 客户端组件构建 UI；前后端共仓共类型，路由文件即页面/接口。Zustand 管理认证与主题状态，所有颜色、间距引用 spec/styles/tokens.css 中的语义化 CSS 变量，Tailwind v4 提供少量原子样式，禁止硬编码值。";

function IconRow({ items }: { items: StackItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-6)",
        flexWrap: "wrap",
        marginBottom: "var(--space-4)",
      }}
    >
      {items.map((it) => (
        <div key={it.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-1)" }}>
          {it.iconUrl && <img src={it.iconUrl} alt={it.name} style={{ width: 48, height: 48 }} />}
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            {it.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AboutPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.health().then((h) => alive && setHealth(h)).catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="cy-container cy-container--narrow" style={{ margin: "var(--space-12) auto var(--space-16)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-5xl)", margin: "0 0 var(--space-4)" }}>
        关于{" "}
        <span
          style={{
            background: "var(--gradient-brand-hero)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          HelloTime Pro
        </span>
      </h1>
      <p
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "var(--font-size-lg)",
          margin: "0 0 var(--space-10)",
          lineHeight: "var(--line-height-relaxed)",
        }}
      >
        时光胶囊 Pro 是一个多技术栈对比学习项目，同一款时光胶囊 Web 应用由多套前后端框架各自独立实现，共享同一份 API 契约、数据库结构与设计令牌。本实现是 <strong>Next.js 全栈</strong> 版本：前端、API、数据库迁移都在同一个 Node 进程里。
      </p>

      <section style={{ marginBottom: "var(--space-10)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-2xl)", margin: "0 0 var(--space-4)" }}>
          前端技术栈
        </h2>
        <IconRow items={FRONTEND_STACK} />
        <p style={{ color: "var(--color-text-secondary)", lineHeight: "var(--line-height-relaxed)", margin: 0 }}>
          {FRONTEND_SUMMARY}
        </p>
      </section>

      {err && <Alert variant="danger">无法读取后端信息：{err}</Alert>}

      {health && (
        <section style={{ marginBottom: "var(--space-10)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-2xl)", margin: "0 0 var(--space-4)" }}>
            后端技术栈 · {health.service} v{health.version}
          </h2>
          <IconRow items={health.stack.items} />
          <p style={{ color: "var(--color-text-secondary)", lineHeight: "var(--line-height-relaxed)", margin: 0 }}>
            {health.stack.summary}
          </p>
        </section>
      )}
    </main>
  );
}
