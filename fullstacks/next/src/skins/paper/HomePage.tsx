// ============================================================
// 「时笺」首页 = 胶囊广场（/）
// Hero（写一枚 + 逛广场 + 就地输码 + 此刻）+ 年鉴 + 工具条 + 信封卡片网格 + 分页
// 结构与类名照 2.0 原型 paper/view-plaza.js
// ============================================================

import { useDisplayDate } from "@/hooks/useNow";
import { useRef, type CSSProperties } from "react";
import { Link } from "@/lib/router";
import { fmt, ms, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { Seg } from "@/components/Seg";
import { pageNumbers, useCountUp, usePlazaHome } from "@/hooks/usePlazaHome";
import { completeCode, useCodeOpen } from "@/hooks/useCodeOpen";
import type { PlazaFilter, PlazaSort } from "@/types";
import { CdShort, Envelope, Postmark, Seal } from "./parts";
import { PaperCard, PaperCardSkeleton } from "./Card";
import { PaperCodeInput } from "./CodeInput";
import { CreateLink } from "@/components/LoginPrompt";

const EmptyArt = () => (
  <svg className="empty__art" viewBox="0 0 120 84" aria-hidden="true">
    <path d="M8 30 60 6l52 24v46H8z" />
    <path d="M8 30l52 30 52-30" />
    <path d="M34 44V22h52v22" className="empty__art-paper" />
    <path d="M44 30h32M44 37h20" />
  </svg>
);

const scrollToPlaza = (e?: React.MouseEvent) => {
  e?.preventDefault();
  document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
};

function QuickOpen() {
  const { state, error, shake, go, value, input: changeCode } = useCodeOpen();
  return (
    <form
      className={`hquick${completeCode(value) ? " is-full" : ""}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void go(value);
      }}
    >
      <div className="hquick__k">
        <Icon name="key" />
        已有胶囊码？在这里开启
      </div>
      <div className="hquick__row">
        <PaperCodeInput
          size="sm"
          state={state}
          shake={shake}
          value={value}
          onChange={changeCode}
          onComplete={(v) => void go(v)}
        />
        <button className="hquick__go" type="submit" aria-label="开启">
          <Icon name="arrow" />
        </button>
      </div>
      <div className="hquick__err" role="alert" data-testid={error ? "open-error" : undefined}>
        {error}
      </div>
    </form>
  );
}

function Hero({ now, featured }: { now: number; featured: ReturnType<typeof usePlazaHome>["featured"] }) {
  const displayDate = useDisplayDate();
  const art = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || reducedMotion() || !hero.current || !art.current) return;
    const r = hero.current.getBoundingClientRect();
    art.current.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    art.current.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const onLeave = () => {
    art.current?.style.setProperty("--mx", "0");
    art.current?.style.setProperty("--my", "0");
  };
  return (
    <section className="hero" ref={hero} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="wrap hero__in">
        <div className="hero__copy">
          <div className="overline">
            <i />
            HelloTime Pro · 时间胶囊
          </div>
          <h1 className="hero__title">
            <span className="hero__line">
              <span className="hero__clip">
                <span>把此刻，</span>
              </span>
            </span>
            <span className="hero__line">
              <span className="hero__clip">
                <span>
                  寄给
                  <em className="hero__future" data-text="未来">
                    未来
                  </em>
                </span>
              </span>
              <Seal ch="封" className="hero__dot" />
            </span>
          </h1>
          <p className="hero__lede">
            写下一段话，再选一个启封的时刻。
            <br />
            在那之前，谁也打不开它——包括你自己。
          </p>
          <div className="hero__cta">
            <CreateLink className="btn btn--primary btn--lg" data-testid="home-create">
              <Icon name="pen" />
              <span>写一枚胶囊</span>
              <Icon name="arrow" className="ic--go" />
            </CreateLink>
            <a className="btn btn--ghost btn--lg" href="#plaza" onClick={scrollToPlaza}>
              <span>逛逛胶囊广场</span>
              <Icon name="arrow" className="ic--go" />
            </a>
          </div>
          <QuickOpen />
          <div className="hero__now" aria-live="off">
            <span className="hero__now-k">此刻</span>
            <span>
              {displayDate.cn(now)} {displayDate.week(now)}
            </span>
            <span className="mono hero__now-t">{displayDate.time(now, true)}</span>
            <span className="hero__lunar">{displayDate.lunar(now)}</span>
          </div>
        </div>
        <div className="hero__art" ref={art}>
          <div className="ha ha--letter" style={{ "--depth": 0.45 } as CSSProperties} aria-hidden="true">
            <div className="ha-letter">
              <div className="ha-letter__to">致 未来 ——</div>
              <p>见字如面。</p>
              <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
              <p>但我想，你一定还记得……</p>
            </div>
          </div>
          <div className="ha ha--env" style={{ "--depth": 0.9 } as CSSProperties} aria-hidden="true">
            <Envelope className="env--hero" />
          </div>
          <div className="ha ha--pm" style={{ "--depth": 1.2 } as CSSProperties} aria-hidden="true">
            <Postmark line1={displayDate.date(now)} line2="此 刻" className="pm--hero" />
          </div>
          {featured ? (
            <Link
              className="ha ha--slip"
              style={{ "--depth": 1.5 } as CSSProperties}
              to={`/capsules/${featured.code}`}
              aria-label={`广场上最受期待的胶囊：${featured.title}`}
            >
              <div className="slip">
                <div className="slip__k">
                  <span className="pulse-dot" />
                  广场上最受期待的一枚
                </div>
                <div className="slip__t">{featured.title}</div>
                <div className="slip__cd">
                  <CdShort openAt={ms(featured.openAt)} now={now} />
                </div>
                <div className="slip__f mono">
                  <span>{featured.code}</span>
                  <span className="slip__fav">
                    <Icon name="heart" />
                    {fmt.num(featured.favoriteCount)}
                  </span>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="hero__side" aria-hidden="true">
        <span>见字如面</span>
        <i />
        <span className="latin">Est. 2026</span>
      </div>
    </section>
  );
}

function AlmanacCell({ k, n, a, b, fromYear }: { k: string; n: number; a: string; b: string; fromYear?: number }) {
  const { ref, value } = useCountUp(n, fromYear ?? 0);
  return (
    <div className="almanac__cell" data-testid="stat" data-key={k} data-value={n}>
      <b className="latin" ref={ref}>
        {fromYear !== undefined ? value : fmt.num(value)}
      </b>
      <span>
        {a}
        <br />
        {b}
      </span>
    </div>
  );
}

export function PaperHomePage() {
  const displayDate = useDisplayDate();
  const h = usePlazaHome();
  const s = h.overview;
  const p = h.pagination;
  const showSkeleton = h.loading && !p;

  return (
    <div className="page page--plaza">
      <Hero now={h.now} featured={h.featured} />

      <section className="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
        {s ? (
          <>
            <AlmanacCell k="all" n={s.counts.all} a="枚胶囊" b="在广场上" />
            <AlmanacCell k="unopened" n={s.counts.unopened} a="枚正在" b="等待启封" />
            <AlmanacCell k="opened" n={s.counts.opened} a="枚已经" b="被人读到" />
            {s.farthestOpenAt ? (
              <AlmanacCell k="farthestYear" n={displayDate.year(ms(s.farthestOpenAt))} a="年，最远的" b="一枚才会打开" fromYear={displayDate.year(h.now)} />
            ) : null}
          </>
        ) : null}
      </section>

      <section className="wrap plaza" id="plaza">
        <header className="plaza__head">
          <div>
            <div className="overline">
              <i />
              Plaza
            </div>
            <h2 className="h2">胶囊广场</h2>
          </div>
          <p className="plaza__sub">
            别人写给未来的话。
            <br />
            有的已经启封，有的还在路上。
          </p>
        </header>

        <div className="toolbar">
          <Seg<PlazaSort>
            label="排序"
            testId="sort-option"
            value={h.sort}
            onChange={h.setSort}
            options={[
              { value: "new", label: (<><Icon name="clock" />最新</>) },
              { value: "hot", label: (<><Icon name="fire" />最热</>) },
            ]}
          />
          <Seg<PlazaFilter>
            label="筛选"
            testId="filter-option"
            value={h.filter}
            onChange={h.setFilter}
            options={[
              { value: "all", label: "全部", count: h.counts?.all },
              { value: "unopened", label: "未开启", count: h.counts?.unopened },
              { value: "opened", label: "已开启", count: h.counts?.opened },
            ]}
          />
          <label className={`search${h.qInput ? " has-value" : ""}`}>
            <Icon name="search" />
            <input
              ref={h.searchRef}
              type="search"
              placeholder="搜索标题或昵称"

              autoComplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              value={h.qInput}
              onChange={(e) => h.setQInput(Array.from(e.target.value).slice(0, 50).join(""))}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  h.setQInput("");
                  e.currentTarget.blur();
                }
              }}
            />
            <kbd>/</kbd>
            <button className="search__x" type="button" aria-label="清空搜索" onClick={h.clearSearch}>
              <Icon name="x" />
            </button>
          </label>
        </div>

        <div className={`grid${h.loading && p ? " is-busy" : ""}`} aria-live="polite">
          {showSkeleton ? (
            Array.from({ length: 6 }, (_, i) => <PaperCardSkeleton key={i} i={i} />)
          ) : h.error ? (
            <div className="empty" data-testid="list-error">
              <EmptyArt />
              <h3>广场暂时打不开</h3>
              <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
              <button className="btn btn--ghost" type="button" data-testid="list-retry" onClick={() => void h.refreshAll()}>
                <Icon name="refresh" />
                重试
              </button>
            </div>
          ) : !h.items.length && p ? (
            h.q.trim() ? (
              <div className="empty" data-testid="list-empty">
                <EmptyArt />
                <h3>没有找到「{h.q.trim()}」</h3>
                <p>换个关键词试试，标题和昵称都可以搜。</p>
                <button className="btn btn--ghost" type="button" onClick={h.clearSearch}>
                  清空搜索
                </button>
              </div>
            ) : (
              <div className="empty" data-testid="list-empty">
                <EmptyArt />
                <h3>广场上还没有胶囊</h3>
                <p>来当第一个写信给未来的人？</p>
                <CreateLink className="btn btn--primary">
                  <Icon name="pen" />
                  写一枚胶囊
                </CreateLink>
              </div>
            )
          ) : (
            h.items.map((c, i) => (
              <PaperCard key={c.id} c={c} i={i} rank={h.rankOf(i)} mine={h.isMine(c.creator.nickname)} now={h.now} />
            ))
          )}
        </div>

        <nav className="pager" aria-label="分页">
          {p && h.items.length ? (
            p.totalPages <= 1 ? (
              <div className="pager__sum">共 {fmt.num(p.total)} 枚</div>
            ) : (
              <>
                <button
                  className="pager__nav"
                  type="button"
                  disabled={p.page <= 1}
                  onClick={() => {
                    h.setPage(p.page - 1);
                    scrollToPlaza();
                  }}
                >
                  <Icon name="chev-left" />
                  上一页
                </button>
                <div className="pager__nums">
                  {pageNumbers(p.page, p.totalPages).map((n, i) =>
                    n === "…" ? (
                      <span key={`g${i}`} className="pager__gap">…</span>
                    ) : (
                      <button
                        key={n}
                        className={`pager__n latin${n === p.page ? " is-active" : ""}`}
                        type="button"
                        aria-current={n === p.page ? "page" : undefined}
                        onClick={() => {
                          h.setPage(n);
                          scrollToPlaza();
                        }}
                      >
                        {n}
                      </button>
                    ),
                  )}
                </div>
                <button
                  className="pager__nav"
                  type="button"
                  disabled={p.page >= p.totalPages}
                  data-testid={p.page < p.totalPages ? "plaza-next" : undefined}
                  onClick={() => {
                    h.setPage(p.page + 1);
                    scrollToPlaza();
                  }}
                >
                  下一页
                  <Icon name="chev-right" />
                </button>
                <div className="pager__sum">
                  共 {fmt.num(p.total)} 枚 · 第 {p.page} / {p.totalPages} 页
                </div>
              </>
            )
          ) : null}
        </nav>
      </section>
    </div>
  );
}
