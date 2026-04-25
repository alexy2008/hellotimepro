import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { HealthData } from "@/types";

export function AppFooter() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => {
        if (alive) setHealth(h);
      })
      .catch(() => {
        // 健康检查失败时回退为静态展示
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className="cy-footer">
      <div className="cy-container cy-footer__inner">
        <div>© 2026 HelloTime Pro · React 参考实现</div>
        <div className="cy-stack">
          {health ? (
            health.stack.items.map((it) => (
              <span key={`${it.role}-${it.name}`} className="cy-stack__item" title={it.role}>
                {it.iconUrl ? <img src={it.iconUrl} alt="" /> : null}
                {it.name}
                <span style={{ color: "var(--color-text-muted)", marginLeft: 4 }}>
                  {it.version}
                </span>
              </span>
            ))
          ) : (
            <>
              <span className="cy-stack__item">React</span>
              <span className="cy-stack__item">TypeScript</span>
              <span className="cy-stack__item">Vite</span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
