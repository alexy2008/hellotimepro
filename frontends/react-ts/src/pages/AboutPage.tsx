import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { Alert } from "@/components/Alert";
import type { HealthData, StackItem } from "@/types";
import techMetaRaw from "@spec/tech-meta.json";

const techMeta = techMetaRaw as Record<string, { tagline: string; features: string[] }>;

const ROLE_LABEL: Record<string, string> = {
  language: "语言",
  framework: "框架",
  database: "数据库",
  runtime: "运行时",
  styling: "样式",
  template: "模板引擎",
};

function withMeta(item: Omit<StackItem, "tagline" | "features">): StackItem {
  const m = techMeta[item.name];
  return { ...item, tagline: m?.tagline ?? null, features: m?.features ?? null };
}

const FRONTEND_STACK: StackItem[] = [
  withMeta({ role: "framework", name: "React", version: "19", iconUrl: "/static/icons/react.svg" }),
  withMeta({ role: "language", name: "TypeScript", version: "5", iconUrl: "/static/icons/typescript.svg" }),
  withMeta({
    role: "styling",
    name: "Tailwind CSS",
    version: "4",
    iconUrl: "/static/icons/tailwindcss.svg",
  }),
];

function TechCard({ item }: { item: StackItem }) {
  const roleLabel = ROLE_LABEL[item.role] ?? item.role;

  return (
    <div
      className="cy-card"
      style={{
        display: "flex",
        gap: "var(--space-6)",
        alignItems: "flex-start",
        padding: "var(--space-6)",
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface-2)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border-subtle)",
        }}
      >
        {item.iconUrl ? (
          <img src={item.iconUrl} alt={item.name} style={{ width: 60, height: 60 }} />
        ) : (
          <span style={{ fontSize: "var(--font-size-2xl)", color: "var(--color-text-muted)" }}>·</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "var(--space-2)",
            marginBottom: "var(--space-2)",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--font-size-xl)",
              margin: 0,
              color: "var(--color-text-primary)",
            }}
          >
            {item.name}
          </h3>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              background: "var(--color-surface-2)",
              color: "var(--color-brand-primary)",
              border: "1px solid var(--color-border-subtle)",
            }}
          >
            v{item.version}
          </span>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-muted)",
            }}
          >
            {roleLabel}
          </span>
        </div>
        {item.tagline && (
          <p
            style={{
              color: "var(--color-text-secondary)",
              margin: "0 0 var(--space-3)",
              lineHeight: "var(--line-height-relaxed)",
            }}
          >
            {item.tagline}
          </p>
        )}
        {item.features && item.features.length > 0 && (
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--space-5)",
              listStyle: "disc",
              color: "var(--color-text-secondary)",
              lineHeight: "var(--line-height-relaxed)",
              fontSize: "var(--font-size-sm)",
            }}
          >
            {item.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StackSection({ title, items }: { title: string; items: StackItem[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginBottom: "var(--space-10)" }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-2xl)",
          margin: "0 0 var(--space-5)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {items.map((it) => (
          <TechCard key={`${it.role}-${it.name}`} item={it} />
        ))}
      </div>
    </section>
  );
}

export function AboutPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  const backendItems = useMemo(() => {
    if (!health) return [];
    const order = ["framework", "language", "database", "styling", "runtime", "template"];
    return [...health.stack.items].sort(
      (a, b) => order.indexOf(a.role) - order.indexOf(b.role),
    );
  }, [health]);

  const backendKind = health?.stack.kind === "fullstack" ? "全栈" : "后端";

  return (
    <main
      className="cy-container cy-container--narrow"
      style={{ margin: "var(--space-12) auto var(--space-16)" }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--font-size-5xl)",
          margin: "0 0 var(--space-4)",
        }}
      >
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
          margin: "0 0 var(--space-8)",
          lineHeight: "var(--line-height-relaxed)",
        }}
      >
        多技术栈对比学习项目 —— 同一款时光胶囊 Web 应用，由若干前后端框架各自实现一遍。
        本页只介绍<strong style={{ color: "var(--color-text-primary)" }}>当前正在运行的这一组栈</strong>，
        后端信息从 <code>/api/v1/health</code> 实时上报。
      </p>

      <Alert variant="info" style={{ marginBottom: "var(--space-10)" }}>
        当前前端是 <strong>React + TypeScript</strong> 实现；后端通过 <code>:9080</code> 反向代理动态切换，无需重启前端。
      </Alert>

      <StackSection title="前端栈" items={FRONTEND_STACK} />

      {error && (
        <Alert variant="danger" style={{ marginBottom: "var(--space-6)" }}>
          无法读取后端 /health 信息：{error}
        </Alert>
      )}

      {health && (
        <StackSection
          title={`${backendKind}栈 · ${health.service} v${health.version}`}
          items={backendItems}
        />
      )}

      <div className="cy-card" style={{ marginBottom: "var(--space-10)" }}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--font-size-xl)",
            margin: "0 0 var(--space-4)",
          }}
        >
          三条硬约束
        </h2>
        <ul
          style={{
            color: "var(--color-text-secondary)",
            margin: 0,
            paddingLeft: "var(--space-5)",
            listStyle: "disc",
            lineHeight: "var(--line-height-relaxed)",
          }}
        >
          <li>
            <strong style={{ color: "var(--color-text-primary)" }}>API 同源：</strong>所有后端实现同一份 <code>spec/api/openapi.yaml</code>。
          </li>
          <li>
            <strong style={{ color: "var(--color-text-primary)" }}>UI 同源：</strong>所有前端消费同一份 <code>spec/styles/tokens.css</code>。
          </li>
          <li>
            <strong style={{ color: "var(--color-text-primary)" }}>数据同源：</strong>所有后端兼容同一份 <code>spec/db/schema.sql</code>。
          </li>
        </ul>
      </div>

      <div
        style={{
          padding: "var(--space-4)",
          borderTop: "1px solid var(--color-border-subtle)",
          color: "var(--color-text-muted)",
          fontSize: "var(--font-size-sm)",
          display: "flex",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <span>
          当前后端: <code>{health?.stack.items.find((it) => it.role === "framework")?.name ?? "—"}</code>
        </span>
        <span>后端版本: <code>{health?.version ?? "—"}</code></span>
        <span>License: MIT</span>
      </div>
    </main>
  );
}
