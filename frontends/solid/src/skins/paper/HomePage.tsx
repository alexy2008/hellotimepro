// ============================================================
// 「时笺」首页 = 胶囊广场（/）
// Hero（写一枚 + 逛广场 + 就地输码 + 此刻）+ 年鉴 + 工具条 + 信封卡片网格 + 分页
// 结构与类名照 2.0 原型 paper/view-plaza.js
// ============================================================

import { For, Index, Match, Show, Switch } from "solid-js";
import { fmt, ms, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { Seg } from "@/components/Seg";
import { CreateLink } from "@/components/LoginPrompt";
import { pageNumbers, createCountUp, type PlazaHome } from "@/primitives/plazaHome";
import { useCodeOpen } from "@/primitives/codeOpen";
import { plaza, refreshAll, setFilter, setPage, setSort } from "@/stores/plaza";
import type { CapsuleListItem, PlazaFilter, PlazaSort } from "@/types";
import { CdShort, Envelope, Postmark, Seal } from "./parts";
import { PaperCard, PaperCardSkeleton } from "./Card";
import { PaperCodeInput } from "./CodeInput";

const EmptyArt = () => (
  <svg class="empty__art" viewBox="0 0 120 84" aria-hidden="true">
    <path d="M8 30 60 6l52 24v46H8z" />
    <path d="M8 30l52 30 52-30" />
    <path d="M34 44V22h52v22" class="empty__art-paper" />
    <path d="M44 30h32M44 37h20" />
  </svg>
);

const scrollToPlaza = (e?: Event) => {
  e?.preventDefault();
  document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
};

function QuickOpen() {
  const o = useCodeOpen();
  return (
    <form
      class={`hquick${o.value().length === 8 ? " is-full" : ""}`}
      novalidate
      onSubmit={(e) => {
        e.preventDefault();
        void o.go(o.value());
      }}
    >
      <div class="hquick__k">
        <Icon name="key" />
        已有胶囊码？在这里开启
      </div>
      <div class="hquick__row">
        <PaperCodeInput size="sm" state={o.state()} shake={o.shake()} value={o.value()} onChange={o.input} onComplete={(v) => void o.go(v)} />
        <button class="hquick__go" type="submit" aria-label="开启">
          <Icon name="arrow" />
        </button>
      </div>
      <div class="hquick__err" role="alert" data-testid={o.error() ? "open-error" : undefined}>
        {o.error()}
      </div>
    </form>
  );
}

function Hero(props: { now: number; featured: CapsuleListItem | null }) {
  let art: HTMLDivElement | undefined;
  let hero: HTMLElement | undefined;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || reducedMotion() || !hero || !art) return;
    const r = hero.getBoundingClientRect();
    art.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    art.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const onLeave = () => {
    art?.style.setProperty("--mx", "0");
    art?.style.setProperty("--my", "0");
  };
  return (
    <section class="hero" ref={hero} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div class="wrap hero__in">
        <div class="hero__copy">
          <div class="overline">
            <i />
            HelloTime Pro · 时间胶囊
          </div>
          <h1 class="hero__title">
            <span class="hero__line">
              <span class="hero__clip">
                <span>把此刻，</span>
              </span>
            </span>
            <span class="hero__line">
              <span class="hero__clip">
                <span>
                  寄给
                  <em class="hero__future" data-text="未来">
                    未来
                  </em>
                </span>
              </span>
              <Seal ch="封" class="hero__dot" />
            </span>
          </h1>
          <p class="hero__lede">
            写下一段话，再选一个启封的时刻。
            <br />
            在那之前，谁也打不开它——包括你自己。
          </p>
          <div class="hero__cta">
            <CreateLink class="btn btn--primary btn--lg" data-testid="home-create">
              <Icon name="pen" />
              <span>写一枚胶囊</span>
              <Icon name="arrow" class="ic--go" />
            </CreateLink>
            <a class="btn btn--ghost btn--lg" href="#plaza" onClick={scrollToPlaza}>
              <span>逛逛胶囊广场</span>
              <Icon name="arrow" class="ic--go" />
            </a>
          </div>
          <QuickOpen />
          <div class="hero__now" aria-live="off">
            <span class="hero__now-k">此刻</span>
            <span>
              {fmt.cn(props.now)} {fmt.week(props.now)}
            </span>
            <span class="mono hero__now-t">{fmt.time(props.now, true)}</span>
            <span class="hero__lunar">{fmt.lunar(props.now)}</span>
          </div>
        </div>
        <div class="hero__art" ref={art}>
          <div class="ha ha--letter" style={{ "--depth": 0.45 }} aria-hidden="true">
            <div class="ha-letter">
              <div class="ha-letter__to">致 未来 ——</div>
              <p>见字如面。</p>
              <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
              <p>但我想，你一定还记得……</p>
            </div>
          </div>
          <div class="ha ha--env" style={{ "--depth": 0.9 }} aria-hidden="true">
            <Envelope class="env--hero" />
          </div>
          <div class="ha ha--pm" style={{ "--depth": 1.2 }} aria-hidden="true">
            <Postmark line1={fmt.date(props.now)} line2="此 刻" class="pm--hero" />
          </div>
          <Show when={props.featured}>
            {(f) => (
              <a class="ha ha--slip" style={{ "--depth": 1.5 }} href={`/capsules/${f().code}`} aria-label={`广场上最受期待的胶囊：${f().title}`}>
                <div class="slip">
                  <div class="slip__k">
                    <span class="pulse-dot" />
                    广场上最受期待的一枚
                  </div>
                  <div class="slip__t">{f().title}</div>
                  <div class="slip__cd">
                    <CdShort openAt={ms(f().openAt)} now={props.now} />
                  </div>
                  <div class="slip__f mono">
                    <span>{f().code}</span>
                    <span class="slip__fav">
                      <Icon name="heart" />
                      {fmt.num(f().favoriteCount)}
                    </span>
                  </div>
                </div>
              </a>
            )}
          </Show>
        </div>
      </div>
      <div class="hero__side" aria-hidden="true">
        <span>见字如面</span>
        <i />
        <span class="latin">Est. 2026</span>
      </div>
    </section>
  );
}

function AlmanacCell(props: { k: string; n: number; a: string; b: string; plain?: boolean }) {
  const [ref, value] = createCountUp(() => props.n, props.plain ? new Date().getFullYear() : 0);
  return (
    <div class="almanac__cell" data-testid="stat" data-key={props.k} data-value={props.n}>
      <b class="latin" ref={ref}>
        {props.plain ? value() : fmt.num(value())}
      </b>
      <span>
        {props.a}
        <br />
        {props.b}
      </span>
    </div>
  );
}

export function PaperHomePage(props: { h: PlazaHome }) {
  const h = props.h;
  const p = () => plaza.pagination;
  const go = (n: number) => {
    setPage(n);
    scrollToPlaza();
  };

  return (
    <div class="page page--plaza">
      <Hero now={h.now()} featured={plaza.featured} />

      <section class="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
        <Show when={plaza.overview}>
          {(s) => (
            <>
              <AlmanacCell k="all" n={s().counts.all} a="枚胶囊" b="在广场上" />
              <AlmanacCell k="unopened" n={s().counts.unopened} a="枚正在" b="等待启封" />
              <AlmanacCell k="opened" n={s().counts.opened} a="枚已经" b="被人读到" />
              <Show when={s().farthestOpenAt}>
                {(at) => <AlmanacCell k="farthestYear" n={new Date(at()).getFullYear()} a="年，最远的" b="一枚才会打开" plain />}
              </Show>
            </>
          )}
        </Show>
      </section>

      <section class="wrap plaza" id="plaza">
        <header class="plaza__head">
          <div>
            <div class="overline">
              <i />
              Plaza
            </div>
            <h2 class="h2">胶囊广场</h2>
          </div>
          <p class="plaza__sub">
            别人写给未来的话。
            <br />
            有的已经启封，有的还在路上。
          </p>
        </header>

        <div class="toolbar">
          <Seg<PlazaSort>
            label="排序"
            testId="sort-option"
            value={plaza.sort}
            onChange={setSort}
            options={[
              {
                value: "new",
                label: (
                  <>
                    <Icon name="clock" />
                    最新
                  </>
                ),
              },
              {
                value: "hot",
                label: (
                  <>
                    <Icon name="fire" />
                    最热
                  </>
                ),
              },
            ]}
          />
          <Seg<PlazaFilter>
            label="筛选"
            testId="filter-option"
            value={plaza.filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "全部", count: plaza.counts?.all },
              { value: "unopened", label: "未开启", count: plaza.counts?.unopened },
              { value: "opened", label: "已开启", count: plaza.counts?.opened },
            ]}
          />
          <label class={`search${plaza.qInput ? " has-value" : ""}`}>
            <Icon name="search" />
            <input
              ref={h.searchRef}
              type="search"
              placeholder="搜索标题或昵称"
              maxLength={50}
              autocomplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              value={plaza.qInput}
              onInput={(e) => h.setQInput(e.currentTarget.value)}
              onKeyDown={h.escSearch}
            />
            <kbd>/</kbd>
            <button class="search__x" type="button" aria-label="清空搜索" onClick={() => h.clearSearch()}>
              <Icon name="x" />
            </button>
          </label>
        </div>

        <div class={`grid${plaza.loading && p() ? " is-busy" : ""}`} aria-live="polite">
          <Switch
            fallback={
              <For each={plaza.items}>
                {(c, i) => <PaperCard c={c} i={i()} rank={h.rankOf(i())} mine={h.isMine(c.creator.nickname)} now={h.now()} />}
              </For>
            }
          >
            <Match when={plaza.loading && !p()}>
              <Index each={Array.from({ length: 6 })}>{(_, i) => <PaperCardSkeleton i={i} />}</Index>
            </Match>
            <Match when={plaza.error}>
              <div class="empty" data-testid="list-error">
                <EmptyArt />
                <h3>广场暂时打不开</h3>
                <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
                <button class="btn btn--ghost" type="button" data-testid="list-retry" onClick={() => void refreshAll()}>
                  <Icon name="refresh" />
                  重试
                </button>
              </div>
            </Match>
            <Match when={!plaza.items.length && p()}>
              <Show
                when={plaza.q.trim()}
                fallback={
                  <div class="empty" data-testid="list-empty">
                    <EmptyArt />
                    <h3>广场上还没有胶囊</h3>
                    <p>来当第一个写信给未来的人？</p>
                    <CreateLink class="btn btn--primary">
                      <Icon name="pen" />
                      写一枚胶囊
                    </CreateLink>
                  </div>
                }
              >
                <div class="empty" data-testid="list-empty">
                  <EmptyArt />
                  <h3>没有找到「{plaza.q.trim()}」</h3>
                  <p>换个关键词试试，标题和昵称都可以搜。</p>
                  <button class="btn btn--ghost" type="button" onClick={() => h.clearSearch()}>
                    清空搜索
                  </button>
                </div>
              </Show>
            </Match>
          </Switch>
        </div>

        <nav class="pager" aria-label="分页">
          <Show when={p() && plaza.items.length ? p() : null}>
            {(pg) => (
              <Show when={pg().totalPages > 1} fallback={<div class="pager__sum">共 {fmt.num(pg().total)} 枚</div>}>
                <button class="pager__nav" type="button" disabled={pg().page <= 1} onClick={() => go(pg().page - 1)}>
                  <Icon name="chev-left" />
                  上一页
                </button>
                <div class="pager__nums">
                  <For each={pageNumbers(pg().page, pg().totalPages)}>
                    {(n) =>
                      n === "…" ? (
                        <span class="pager__gap">…</span>
                      ) : (
                        <button
                          class={`pager__n latin${n === pg().page ? " is-active" : ""}`}
                          type="button"
                          aria-current={n === pg().page ? "page" : undefined}
                          onClick={() => go(n)}
                        >
                          {n}
                        </button>
                      )
                    }
                  </For>
                </div>
                <button
                  class="pager__nav"
                  type="button"
                  disabled={pg().page >= pg().totalPages}
                  data-testid={pg().page < pg().totalPages ? "plaza-next" : undefined}
                  onClick={() => go(pg().page + 1)}
                >
                  下一页
                  <Icon name="chev-right" />
                </button>
                <div class="pager__sum">
                  共 {fmt.num(pg().total)} 枚 · 第 {pg().page} / {pg().totalPages} 页
                </div>
              </Show>
            )}
          </Show>
        </nav>
      </section>
    </div>
  );
}
