// 广场首页 —— React Server Component：在服务端读取 cookie 识别用户、直接调用 service
// 取数并渲染（无客户端 store、无 /api 往返）。排序/筛选/搜索由 URL searchParams 驱动，
// 交互仅保留必要的客户端孤岛（工具栏导航、收藏按钮）。
import Link from "next/link";
import { plazaList } from "@/services/plaza";
import { getServerViewer } from "@/lib/server/session";
import { CapsuleCard } from "@/components/capsule-card";
import { PlazaToolbar } from "@/components/plaza-toolbar";
import { fmtNumber } from "@/lib/format";
import type { PlazaFilter, PlazaSort } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 20;

function parseParams(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort: PlazaSort = get("sort") === "hot" ? "hot" : "new";
  const filterRaw = get("filter");
  const filter: PlazaFilter =
    filterRaw === "opened" || filterRaw === "unopened" ? filterRaw : "all";
  const q = (get("q") ?? "").slice(0, 50);
  const page = Math.max(1, Number.parseInt(get("page") ?? "1", 10) || 1);
  return { sort, filter, q, page };
}

function pageHref(params: { sort: PlazaSort; filter: PlazaFilter; q: string }, page: number) {
  const usp = new URLSearchParams();
  if (params.sort !== "new") usp.set("sort", params.sort);
  if (params.filter !== "all") usp.set("filter", params.filter);
  if (params.q) usp.set("q", params.q);
  if (page > 1) usp.set("page", String(page));
  const qs = usp.toString();
  return qs ? `/?${qs}` : "/";
}

export default async function PlazaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sort, filter, q, page } = parseParams(await searchParams);
  const viewer = await getServerViewer();
  const data = await plazaList({
    sort,
    filter,
    q: q || null,
    page,
    pageSize: PAGE_SIZE,
    viewerId: viewer?.id ?? null,
  });
  const { items, pagination } = data;

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
            <Link className="cy-btn cy-btn--primary cy-btn--hero" href={viewer ? "/create" : "/register"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1-1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
              </svg>
              创建我的胶囊
            </Link>
            <Link className="cy-btn cy-btn--success cy-btn--hero" href="/open">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
              用胶囊码开启
            </Link>
          </div>
        </div>
      </section>

      <main className="cy-container">
        <PlazaToolbar sort={sort} filter={filter} q={q} />

        {items.length === 0 ? (
          <div className="cy-empty">
            <div className="cy-empty__emoji">🌌</div>
            <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
            <Link
              className="cy-btn cy-btn--primary cy-btn--sm"
              href={viewer ? "/create" : "/register"}
              style={{ marginTop: "var(--space-3)" }}
            >
              {viewer ? "创建胶囊" : "注册并创建"}
            </Link>
          </div>
        ) : (
          <div className="cy-grid">
            {items.map((c) => (
              <CapsuleCard key={c.id} capsule={c} />
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "var(--space-3)",
              margin: "var(--space-10) 0 var(--space-6)",
            }}
          >
            {page > 1 ? (
              <Link className="cy-btn cy-btn--ghost cy-btn--sm" href={pageHref({ sort, filter, q }, page - 1)}>
                上一页
              </Link>
            ) : (
              <button type="button" className="cy-btn cy-btn--ghost cy-btn--sm" disabled>
                上一页
              </button>
            )}
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
              第 {page} / {pagination.totalPages} 页 · 共 {fmtNumber(pagination.total)} 条
            </span>
            {page < pagination.totalPages ? (
              <Link className="cy-btn cy-btn--ghost cy-btn--sm" href={pageHref({ sort, filter, q }, page + 1)}>
                下一页
              </Link>
            ) : (
              <button type="button" className="cy-btn cy-btn--ghost cy-btn--sm" disabled>
                下一页
              </button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
