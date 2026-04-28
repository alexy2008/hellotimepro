import { useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlaza } from "@/stores/plaza";
import { useAuth } from "@/stores/auth";
import { PlazaToolbar } from "@/components/PlazaToolbar";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { fmtNumber } from "@/utils/format";

export function PlazaPage() {
  const fetchPlaza = usePlaza((s) => s.fetch);
  const items = usePlaza((s) => s.items);
  const loading = usePlaza((s) => s.loading);
  const pagination = usePlaza((s) => s.pagination);
  const page = usePlaza((s) => s.page);
  const setPage = usePlaza((s) => s.setPage);

  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    // 等鉴权 hydrate 完再请求，让 favoritedByMe 投影正确
    if (hydrated) void fetchPlaza();
  }, [hydrated, fetchPlaza]);

  return (
    <>
      <section className="cy-hero-block">
        <div className="cy-container">
          <h1 className="cy-hero-title">
            封存此刻 <span className="cy-hero-title__highlight">开启未来</span>
          </h1>
          <p className="cy-hero-subtitle">
            写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
          </p>
          <div className="cy-hero-cta">
            <Link className="cy-btn cy-btn--primary cy-btn--hero" to={user ? "/create" : "/register"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
              </svg>
              创建我的胶囊
            </Link>
            <Link className="cy-btn cy-btn--success cy-btn--hero" to="/open">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
              用胶囊码开启
            </Link>
          </div>
        </div>
      </section>

      <main className="cy-container">
        <PlazaToolbar />
        <CapsuleGrid
          items={items}
          loading={loading}
          emptyHint={
            <div className="cy-empty">
              <div className="cy-empty__emoji">🌌</div>
              <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
              <Link
                className="cy-btn cy-btn--primary cy-btn--sm"
                to={user ? "/create" : "/register"}
                style={{ marginTop: "var(--space-3)" }}
              >
                {user ? "创建胶囊" : "注册并创建"}
              </Link>
            </div>
          }
        />

        {pagination && pagination.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "var(--space-3)",
              margin: "var(--space-10) 0 var(--space-6)",
            }}
          >
            <button
              type="button"
              className="cy-btn cy-btn--ghost cy-btn--sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </button>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              第 {page} / {pagination.totalPages} 页 · 共 {fmtNumber(pagination.total)} 条
            </span>
            <button
              type="button"
              className="cy-btn cy-btn--ghost cy-btn--sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
        )}
      </main>
    </>
  );
}
