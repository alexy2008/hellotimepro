import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { HealthData } from "@/types";

const FRONTEND_ITEMS = [
  { role: "frontend-framework", name: "React", iconUrl: "/static/icons/react.svg" },
  { role: "frontend-language", name: "TypeScript", iconUrl: "/static/icons/typescript.svg" },
];

export function AppFooter() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => {
        if (alive) {
          setHealth(h);
          setConnected(true);
        }
      })
      .catch(() => {
        if (alive) setConnected(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const backendItems = health?.stack.items ?? [];
  const dotClass =
    connected === true
      ? "cy-backend-dot cy-backend-dot--online"
      : connected === false
        ? "cy-backend-dot cy-backend-dot--offline"
        : "cy-backend-dot";

  return (
    <footer className="cy-footer">
      <div className="cy-container cy-footer__inner">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          © 2026 HelloTime Pro
          <span
            className={dotClass}
            title={
              connected === true ? "后端在线" : connected === false ? "后端离线" : "连接中…"
            }
          />
        </div>
        <div className="cy-stack">
          {FRONTEND_ITEMS.map((it) => (
            <span key={it.role} className="cy-stack__item" title={it.role}>
              <img src={it.iconUrl} alt="" />
              {it.name}
            </span>
          ))}
          {backendItems.map((it) => (
            <span key={`${it.role}-${it.name}`} className="cy-stack__item" title={it.role}>
              {it.iconUrl ? <img src={it.iconUrl} alt="" /> : null}
              {it.name}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
