// ============================================================
// 「琥珀」首页 = 主视觉 + 年鉴 + 胶囊广场（/）
// 主视觉：「把此刻，寄给未来。」+ 两个入口 + 就地输码 + 时间表盘 + 精选凭条
// 结构与类名照 2.0 原型 amber/view-plaza.js
// ============================================================

import { For, Index, Match, Show, Switch, onCleanup, onMount, type JSX } from "solid-js";
import { fmt, ms, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { Seg } from "@/components/Seg";
import { CreateLink } from "@/components/LoginPrompt";
import { pageNumbers, type PlazaHome } from "@/primitives/plazaHome";
import { useCodeOpen } from "@/primitives/codeOpen";
import { plaza, refreshAll, setFilter, setPage, setSort } from "@/stores/plaza";
import type { PlazaFilter, PlazaSort } from "@/types";
import { CapsuleArt, cdShort, sparkle } from "./parts";
import { AmberCard, AmberCardSkeleton } from "./Card";
import { AmberCodeInput } from "./CodeInput";

const scrollToPlaza = (e?: Event) => {
  e?.preventDefault();
  document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
};

const SPARKS = [
  [72, 96, 14],
  [522, 90, 9],
  [550, 452, 12],
  [60, 474, 8],
  [404, 226, 6],
] as const;

/** 主视觉：一枚悬浮在「时间表盘」中央的胶囊。三层圆环反向旋转，年份环缓缓流过；鼠标带一点视差 */
function HeroArt() {
  let el: HTMLDivElement | undefined;
  onMount(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty("--tilt-x", `${(-dy * 14).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(dx * 16).toFixed(2)}deg`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    onCleanup(() => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    });
  });
  const y0 = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => y0 + i).join(" · ") + " · ";
  return (
    <div class="hart" ref={el} aria-hidden="true">
      <svg class="hart__svg" viewBox="0 0 600 600">
        <defs>
          <radialGradient id="hHalo" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#ffb347" stop-opacity=".4" />
            <stop offset=".55" stop-color="#8f7dff" stop-opacity=".12" />
            <stop offset="1" stop-color="#8f7dff" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="hMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#fff2c2" />
            <stop offset=".22" stop-color="#ffc65c" />
            <stop offset=".6" stop-color="#f6902c" />
            <stop offset=".86" stop-color="#d9641a" />
            <stop offset="1" stop-color="#ffb45a" />
          </linearGradient>
          <linearGradient id="hSeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#5a4ec2" />
            <stop offset=".3" stop-color="#2c2674" />
            <stop offset="1" stop-color="#120f38" />
          </linearGradient>
          <radialGradient id="hCore" cx=".5" cy=".5" r=".5">
            <stop offset="0" stop-color="#fff3c9" stop-opacity=".95" />
            <stop offset=".38" stop-color="#ffb347" stop-opacity=".55" />
            <stop offset="1" stop-color="#ff7a45" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="hArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ffe08a" />
            <stop offset="1" stop-color="#ff7b4a" />
          </linearGradient>
          <clipPath id="hGlassClip">
            <path d="M238 300V388A62 62 0 0 0 362 388V300Z" />
          </clipPath>
          <path id="hYearPath" d="M68 300a232 232 0 1 1 464 0a232 232 0 1 1-464 0" />
        </defs>
        <circle class="hart__halo" cx="300" cy="300" r="260" fill="url(#hHalo)" />
        <g class="hart__ring hart__ring--outer">
          <circle class="hart__ticks" cx="300" cy="300" r="278" />
          <circle class="hart__planet hart__planet--amber" cx="300" cy="22" r="5.5" />
          <circle class="hart__planet hart__planet--cyan" cx="496.6" cy="496.6" r="3.6" />
        </g>
        <g class="hart__ring hart__ring--years">
          <text class="hart__years">
            <textPath href="#hYearPath" textLength="1440" lengthAdjust="spacing">
              {years}
            </textPath>
          </text>
        </g>
        <g class="hart__ring hart__ring--mid">
          <circle class="hart__line" cx="300" cy="300" r="204" />
          <circle class="hart__major" cx="300" cy="300" r="204" />
          <circle class="hart__planet hart__planet--violet" cx="96" cy="300" r="7" />
        </g>
        <g class="hart__ring hart__ring--inner">
          <circle class="hart__dash" cx="300" cy="300" r="162" />
          <circle class="hart__arc" cx="300" cy="300" r="162" stroke="url(#hArc)" />
        </g>
        <ellipse class="hart__shadow" cx="300" cy="492" rx="96" ry="12" />
        <g class="hart__capsule">
          <g transform="rotate(26 300 300)">
            <path class="hart__glass" d="M238 300V388A62 62 0 0 0 362 388V300Z" />
            <g clip-path="url(#hGlassClip)">
              <circle class="hart__core" cx="300" cy="372" r="84" fill="url(#hCore)" />
              <rect class="hart__scroll" x="270" y="322" width="60" height="94" rx="9" />
              <path class="hart__scroll-line" d="M282 342h36M282 354h36M282 366h22" />
              <rect class="hart__ribbon" x="270" y="382" width="60" height="11" />
              <circle class="hart__wax" cx="300" cy="387.5" r="8.5" />
            </g>
            <path class="hart__reflection" d="M254 316V386A46 46 0 0 0 268 420" />
            <path d="M238 300V212A62 62 0 0 1 362 212V300Z" fill="url(#hMetal)" />
            <path class="hart__groove" d="M238 268h124M238 280h124" />
            <circle class="hart__emblem" cx="300" cy="216" r="24" />
            <path class="hart__hand" d="M300 202v14l9 6" />
            <path class="hart__highlight" d="M256 284V214A44 44 0 0 1 280 176" />
            <rect x="230" y="291" width="140" height="18" rx="9" fill="url(#hSeam)" />
            <path class="hart__seam-light" d="M242 296h116" />
          </g>
        </g>
        <For each={SPARKS}>
          {([x, y, r], i) => <path class="hart__spark" style={{ "animation-delay": `${-i() * 0.7}s` }} d={sparkle(x, y, r)} />}
        </For>
      </svg>
    </div>
  );
}

function QuickOpen() {
  const o = useCodeOpen();
  return (
    <form
      class="quick card"
      novalidate
      onSubmit={(e) => {
        e.preventDefault();
        void o.go(o.value());
      }}
    >
      <div class="quick__k">
        <Icon name="key" />
        已有胶囊码？在这里开启
      </div>
      <div class="quick__row">
        <AmberCodeInput size="md" state={o.state()} shake={o.shake()} value={o.value()} onChange={o.input} onComplete={(v) => void o.go(v)} />
        <button class="btn btn--soft" type="submit">
          开启
          <Icon name="arrow" />
        </button>
      </div>
      <div class="quick__err" role="alert" data-testid={o.error() ? "open-error" : undefined}>
        {o.error()}
      </div>
    </form>
  );
}

function StatCell(props: { k: string; n: number; a: string; b: string; i: number }) {
  return (
    <div class="stats__cell" style={{ "--i": props.i }} data-testid="stat" data-key={props.k} data-value={props.n}>
      <b class="mono">{props.n}</b>
      <span>
        {props.a}
        <br />
        {props.b}
      </span>
    </div>
  );
}

function EmptyBox(props: { title: string; text: string; testId: string; children?: JSX.Element }) {
  return (
    <div class="empty" data-testid={props.testId}>
      <CapsuleArt code={null} state="opened" width={170} class="empty__art" />
      <h3 class="empty__title">{props.title}</h3>
      <p>{props.text}</p>
      {props.children}
    </div>
  );
}

export function AmberHomePage(props: { h: PlazaHome }) {
  const h = props.h;
  const p = () => plaza.pagination;
  const go = (n: number) => {
    setPage(n);
    scrollToPlaza();
  };

  return (
    <div class="page page--home">
      <section class="hero container">
        <div class="hero__copy">
          <div class="eyebrow">HelloTime Pro · 时间胶囊</div>
          <h1 class="hero__title">
            <span class="hero__line">把此刻，</span>
            <span class="hero__line">
              寄给<em class="hero__future">未来</em>。
            </span>
          </h1>
          <p class="hero__lede">
            写下一段话，选定一个未来的时刻，把它封进胶囊。
            <br />
            在那之前，谁也读不到——包括你自己。
          </p>
          <div class="hero__cta">
            <CreateLink class="btn btn--primary btn--lg" data-testid="home-create">
              <Icon name="pen" />
              写一枚胶囊
            </CreateLink>
            <a class="btn btn--ghost btn--lg" href="#plaza" onClick={scrollToPlaza}>
              逛逛胶囊广场
              <Icon name="arrow" class="ic--go" />
            </a>
          </div>
          <QuickOpen />
          <div class="hero__now">
            <span class="hero__live" />
            此刻 ·{" "}
            <span class="mono">
              {fmt.date(h.now()).replace(/\./g, "-")} {fmt.time(h.now(), true)}
            </span>
          </div>
        </div>
        <div class="hero__art">
          <HeroArt />
          <Show when={plaza.featured}>
            {(f) => (
              <a class="slip" href={`/capsules/${f().code}`} style={{ "--glow": paletteOf(f().code).glow }}>
                <div class="slip__k">
                  <span class="slip__dot" />
                  广场上最受期待的一枚
                </div>
                <div class="slip__row">
                  <CapsuleArt code={f().code} state="locked" width={64} />
                  <div>
                    <b class="slip__t">{f().title}</b>
                    <span class="slip__cd mono">{cdShort(ms(f().openAt), h.now())}</span>
                  </div>
                </div>
                <div class="slip__f">
                  <Icon name="heart" />
                  {fmt.num(f().favoriteCount)} 人在等它
                </div>
              </a>
            )}
          </Show>
        </div>
      </section>

      <section class="container stats" aria-label="广场概览" data-testid="plaza-stats">
        <Show when={plaza.overview}>
          {(s) => (
            <>
              <StatCell i={0} k="all" n={s().counts.all} a="枚胶囊" b="在广场上" />
              <StatCell i={1} k="unopened" n={s().counts.unopened} a="枚正在" b="等待开启" />
              <StatCell i={2} k="opened" n={s().counts.opened} a="枚已经" b="被人读到" />
              <Show when={s().farthestOpenAt}>
                {(at) => <StatCell i={3} k="farthestYear" n={new Date(at()).getFullYear()} a="年，最远的" b="一枚才会打开" />}
              </Show>
            </>
          )}
        </Show>
      </section>

      <section class="container plaza" id="plaza">
        <header class="page-head page-head--split">
          <div>
            <div class="eyebrow">Capsule Plaza</div>
            <h2 class="page-title">胶囊广场</h2>
            <p class="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
          </div>
          <CreateLink class="btn btn--primary">
            <Icon name="pen" />
            我也放一枚
          </CreateLink>
        </header>

        <div class="toolbar card">
          <label class={`search input-wrap${plaza.qInput ? " has-value" : ""}`}>
            <Icon name="search" class="input-wrap__icon" />
            <input
              ref={h.searchRef}
              class="input"
              type="search"
              placeholder="搜索标题或昵称…"
              maxLength={50}
              autocomplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              value={plaza.qInput}
              onInput={(e) => h.setQInput(e.currentTarget.value)}
              onKeyDown={h.escSearch}
            />
            <kbd class="kbd">/</kbd>
            <button class="search__x icon-btn" type="button" aria-label="清空搜索" onClick={() => h.clearSearch()}>
              <Icon name="x" />
            </button>
          </label>
          <Seg<PlazaFilter>
            label="筛选"
            testId="filter-option"
            value={plaza.filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "全部", count: plaza.counts?.all },
              { value: "unopened", label: "封存中", count: plaza.counts?.unopened },
              { value: "opened", label: "已开启", count: plaza.counts?.opened },
            ]}
          />
          <div class="select">
            <select aria-label="排序" data-testid="plaza-sort" value={plaza.sort} onChange={(e) => setSort(e.currentTarget.value as PlazaSort)}>
              <option value="new">最新封存</option>
              <option value="hot">最多收藏</option>
            </select>
            <Icon name="chev-down" class="select__arrow" />
          </div>
        </div>

        <div class="plaza__count">
          <Show when={p()}>
            {(pg) => (
              <>
                共 <b>{fmt.num(pg().total)}</b> 枚胶囊{plaza.q.trim() ? ` · 关键词「${plaza.q.trim()}」` : ""}
              </>
            )}
          </Show>
        </div>

        <div class={`grid${plaza.loading && p() ? " is-busy" : ""}`} aria-live="polite">
          <Switch
            fallback={
              <For each={plaza.items}>
                {(c, i) => <AmberCard c={c} i={i()} rank={h.rankOf(i())} mine={h.isMine(c.creator.nickname)} now={h.now()} />}
              </For>
            }
          >
            <Match when={plaza.loading && !p()}>
              <Index each={Array.from({ length: 6 })}>{(_, i) => <AmberCardSkeleton i={i} />}</Index>
            </Match>
            <Match when={plaza.error}>
              <EmptyBox testId="list-error" title="广场暂时打不开" text="没能连上后端。请确认服务已启动，或稍后再试。">
                <button class="btn btn--ghost" type="button" data-testid="list-retry" onClick={() => void refreshAll()}>
                  <Icon name="refresh" />
                  重试
                </button>
              </EmptyBox>
            </Match>
            <Match when={!plaza.items.length && p()}>
              <Show
                when={plaza.q.trim()}
                fallback={
                  <EmptyBox testId="list-empty" title="广场上还没有胶囊" text="来当第一个写信给未来的人？">
                    <CreateLink class="btn btn--primary">
                      <Icon name="pen" />
                      写一枚胶囊
                    </CreateLink>
                  </EmptyBox>
                }
              >
                <EmptyBox testId="list-empty" title={`没有找到「${plaza.q.trim()}」`} text="换个关键词试试，标题和昵称都可以搜。">
                  <button class="btn btn--ghost" type="button" onClick={() => h.clearSearch()}>
                    清空搜索
                  </button>
                </EmptyBox>
              </Show>
            </Match>
          </Switch>
        </div>

        <nav class="pager" aria-label="分页">
          <Show when={p() && p()!.totalPages > 1 && plaza.items.length ? p() : null}>
            {(pg) => (
              <>
                <button class="pager__btn" type="button" disabled={pg().page <= 1} aria-label="上一页" onClick={() => go(pg().page - 1)}>
                  <Icon name="chev-left" />
                </button>
                <For each={pageNumbers(pg().page, pg().totalPages)}>
                  {(n) =>
                    n === "…" ? (
                      <span class="pager__gap">…</span>
                    ) : (
                      <button
                        class={`pager__btn${n === pg().page ? " is-active" : ""}`}
                        type="button"
                        aria-current={n === pg().page ? "page" : undefined}
                        onClick={() => go(n)}
                      >
                        {n}
                      </button>
                    )
                  }
                </For>
                <button
                  class="pager__btn"
                  type="button"
                  disabled={pg().page >= pg().totalPages}
                  aria-label="下一页"
                  data-testid={pg().page < pg().totalPages ? "plaza-next" : undefined}
                  onClick={() => go(pg().page + 1)}
                >
                  <Icon name="chev-right" />
                </button>
              </>
            )}
          </Show>
        </nav>
      </section>
    </div>
  );
}
