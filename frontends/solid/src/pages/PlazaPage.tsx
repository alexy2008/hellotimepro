import { createEffect, untrack } from "solid-js";
import { A } from "@solidjs/router";
import { plaza, fetchPlaza, setPage } from "@/stores/plaza";
import { auth } from "@/stores/auth";
import { PlazaToolbar } from "@/components/PlazaToolbar";
import { CapsuleGrid } from "@/components/CapsuleGrid";
import { Pagination } from "@/components/Pagination";
import { fmtNumber } from "@/utils/format";

export function PlazaPage() {
  // 首屏加载：等鉴权 hydrate 完再请求，让 favoritedByMe 投影正确。
  // 用 untrack 包住 fetchPlaza —— 它内部同步读取 plaza.sort/filter/q/page 来构造请求参数，
  // 若被 effect 追踪，setSort/setFilter/setQ/setPage 会在自己调用 fetch 之外再触发本 effect 一次，
  // 造成重复请求。本 effect 只应订阅 auth.hydrated。
  createEffect(() => {
    if (auth.hydrated) untrack(() => void fetchPlaza());
  });

  return (
    <>
      <section class="cy-hero-block">
        <div class="cy-container">
          <h1 class="cy-hero-title">
            封存此刻 <span class="cy-hero-title__highlight">开启未来</span>
          </h1>
          <p class="cy-hero-subtitle">
            写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
          </p>
          <div class="cy-hero-cta">
            <A
              class="cy-btn cy-btn--primary cy-btn--hero"
              href={auth.user ? "/create" : "/register"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
              </svg>
              创建我的胶囊
            </A>
            <A class="cy-btn cy-btn--success cy-btn--hero" href="/open">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
              </svg>
              用胶囊码开启
            </A>
          </div>
        </div>
      </section>

      <main class="cy-container">
        <PlazaToolbar />
        <CapsuleGrid
          items={plaza.items}
          loading={plaza.loading}
          emptyHint={
            <div class="cy-empty">
              <div class="cy-empty__emoji">🌌</div>
              <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
              <A
                class="cy-btn cy-btn--primary cy-btn--sm"
                href={auth.user ? "/create" : "/register"}
                style={{ "margin-top": "var(--space-3)" }}
              >
                {auth.user ? "创建胶囊" : "注册并创建"}
              </A>
            </div>
          }
        />

        <Pagination
          page={plaza.page}
          totalPages={plaza.pagination?.totalPages ?? 0}
          onChange={setPage}
          extra={plaza.pagination ? `共 ${fmtNumber(plaza.pagination.total)} 条` : undefined}
          margin="var(--space-10) 0 var(--space-6)"
        />
      </main>
    </>
  );
}
