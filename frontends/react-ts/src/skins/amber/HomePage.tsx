// ============================================================
// 「琥珀」首页 = 主视觉 + 年鉴 + 胶囊广场（/）
// 主视觉：「把此刻，寄给未来。」+ 两个入口 + 就地输码 + 时间表盘 + 精选凭条
// 结构与类名照 2.0 原型 amber/view-plaza.js
// ============================================================

import { useEffect, useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { fmt, ms, reducedMotion } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";
import { Seg } from "@/components/Seg";
import { pageNumbers, usePlazaHome } from "@/hooks/usePlazaHome";
import { useCodeOpen } from "@/hooks/useCodeOpen";
import type { PlazaFilter, PlazaSort } from "@/types";
import { CapsuleArt, cdShort } from "./parts";
import { AmberCard, AmberCardSkeleton } from "./Card";
import { AmberCodeInput } from "./CodeInput";
import { CreateLink } from "@/components/LoginPrompt";

/** 四角星芒 */
function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.14;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

const scrollToPlaza = (e?: React.MouseEvent) => {
  e?.preventDefault();
  document.getElementById("plaza")?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
};

/** 主视觉：一枚悬浮在「时间表盘」中央的胶囊。三层圆环反向旋转，年份环缓缓流过；鼠标带一点视差 */
function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty("--tilt-x", `${(-dy * 14).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(dx * 16).toFixed(2)}deg`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  const y0 = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => y0 + i).join(" · ") + " · ";
  return (
    <div className="hart" ref={ref} aria-hidden="true">
      <svg className="hart__svg" viewBox="0 0 600 600">
        <defs>
          <radialGradient id="hHalo" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#ffb347" stopOpacity=".4" />
            <stop offset=".55" stopColor="#8f7dff" stopOpacity=".12" />
            <stop offset="1" stopColor="#8f7dff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff2c2" />
            <stop offset=".22" stopColor="#ffc65c" />
            <stop offset=".6" stopColor="#f6902c" />
            <stop offset=".86" stopColor="#d9641a" />
            <stop offset="1" stopColor="#ffb45a" />
          </linearGradient>
          <linearGradient id="hSeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#5a4ec2" />
            <stop offset=".3" stopColor="#2c2674" />
            <stop offset="1" stopColor="#120f38" />
          </linearGradient>
          <radialGradient id="hCore" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#fff3c9" stopOpacity=".95" />
            <stop offset=".38" stopColor="#ffb347" stopOpacity=".55" />
            <stop offset="1" stopColor="#ff7a45" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe08a" />
            <stop offset="1" stopColor="#ff7b4a" />
          </linearGradient>
          <clipPath id="hGlassClip">
            <path d="M238 300V388A62 62 0 0 0 362 388V300Z" />
          </clipPath>
          <path id="hYearPath" d="M68 300a232 232 0 1 1 464 0a232 232 0 1 1-464 0" />
        </defs>
        <circle className="hart__halo" cx="300" cy="300" r="260" fill="url(#hHalo)" />
        <g className="hart__ring hart__ring--outer">
          <circle className="hart__ticks" cx="300" cy="300" r="278" />
          <circle className="hart__planet hart__planet--amber" cx="300" cy="22" r="5.5" />
          <circle className="hart__planet hart__planet--cyan" cx="496.6" cy="496.6" r="3.6" />
        </g>
        <g className="hart__ring hart__ring--years">
          <text className="hart__years">
            <textPath href="#hYearPath" textLength="1440" lengthAdjust="spacing">
              {years}
            </textPath>
          </text>
        </g>
        <g className="hart__ring hart__ring--mid">
          <circle className="hart__line" cx="300" cy="300" r="204" />
          <circle className="hart__major" cx="300" cy="300" r="204" />
          <circle className="hart__planet hart__planet--violet" cx="96" cy="300" r="7" />
        </g>
        <g className="hart__ring hart__ring--inner">
          <circle className="hart__dash" cx="300" cy="300" r="162" />
          <circle className="hart__arc" cx="300" cy="300" r="162" stroke="url(#hArc)" />
        </g>
        <ellipse className="hart__shadow" cx="300" cy="492" rx="96" ry="12" />
        <g className="hart__capsule">
          <g transform="rotate(26 300 300)">
            <path className="hart__glass" d="M238 300V388A62 62 0 0 0 362 388V300Z" />
            <g clipPath="url(#hGlassClip)">
              <circle className="hart__core" cx="300" cy="372" r="84" fill="url(#hCore)" />
              <rect className="hart__scroll" x="270" y="322" width="60" height="94" rx="9" />
              <path className="hart__scroll-line" d="M282 342h36M282 354h36M282 366h22" />
              <rect className="hart__ribbon" x="270" y="382" width="60" height="11" />
              <circle className="hart__wax" cx="300" cy="387.5" r="8.5" />
            </g>
            <path className="hart__reflection" d="M254 316V386A46 46 0 0 0 268 420" />
            <path d="M238 300V212A62 62 0 0 1 362 212V300Z" fill="url(#hMetal)" />
            <path className="hart__groove" d="M238 268h124M238 280h124" />
            <circle className="hart__emblem" cx="300" cy="216" r="24" />
            <path className="hart__hand" d="M300 202v14l9 6" />
            <path className="hart__highlight" d="M256 284V214A44 44 0 0 1 280 176" />
            <rect x="230" y="291" width="140" height="18" rx="9" fill="url(#hSeam)" />
            <path className="hart__seam-light" d="M242 296h116" />
          </g>
        </g>
        {([[72, 96, 14], [522, 90, 9], [550, 452, 12], [60, 474, 8], [404, 226, 6]] as const).map(([x, y, r], i) => (
          <path key={i} className="hart__spark" style={{ animationDelay: `${-i * 0.7}s` }} d={sparkle(x, y, r)} />
        ))}
      </svg>
    </div>
  );
}

function QuickOpen() {
  const { state, error, shake, go, reset } = useCodeOpen();
  const value = useRef("");
  return (
    <form
      className="quick card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void go(value.current);
      }}
    >
      <div className="quick__k">
        <Icon name="key" />
        已有胶囊码？在这里开启
      </div>
      <div className="quick__row">
        <AmberCodeInput
          size="md"
          state={state}
          shake={shake}
          onChange={(v) => {
            value.current = v;
            reset();
          }}
          onComplete={(v) => void go(v)}
        />
        <button className="btn btn--soft" type="submit">
          开启
          <Icon name="arrow" />
        </button>
      </div>
      <div className="quick__err" role="alert" data-testid={error ? "open-error" : undefined}>
        {error}
      </div>
    </form>
  );
}

function StatCell({ k, n, a, b, i }: { k: string; n: number; a: string; b: string; i: number }) {
  return (
    <div className="stats__cell" style={{ "--i": i } as CSSProperties} data-testid="stat" data-key={k} data-value={n}>
      <b className="mono">{n}</b>
      <span>
        {a}
        <br />
        {b}
      </span>
    </div>
  );
}

const EmptyBox = ({ title, text, action, testId }: { title: string; text: string; action?: React.ReactNode; testId: string }) => (
  <div className="empty" data-testid={testId}>
    <CapsuleArt code={null} state="opened" width={170} className="empty__art" />
    <h3 className="empty__title">{title}</h3>
    <p>{text}</p>
    {action}
  </div>
);

export function AmberHomePage() {
  const h = usePlazaHome();
  const s = h.overview;
  const p = h.pagination;
  const f = h.featured;

  return (
    <div className="page page--home">
      <section className="hero container">
        <div className="hero__copy">
          <div className="eyebrow">HelloTime Pro · 时间胶囊</div>
          <h1 className="hero__title">
            <span className="hero__line">把此刻，</span>
            <span className="hero__line">
              寄给<em className="hero__future">未来</em>。
            </span>
          </h1>
          <p className="hero__lede">
            写下一段话，选定一个未来的时刻，把它封进胶囊。
            <br />
            在那之前，谁也读不到——包括你自己。
          </p>
          <div className="hero__cta">
            <CreateLink className="btn btn--primary btn--lg" data-testid="home-create">
              <Icon name="pen" />
              写一枚胶囊
            </CreateLink>
            <a className="btn btn--ghost btn--lg" href="#plaza" onClick={scrollToPlaza}>
              逛逛胶囊广场
              <Icon name="arrow" className="ic--go" />
            </a>
          </div>
          <QuickOpen />
          <div className="hero__now">
            <span className="hero__live" />
            此刻 · <span className="mono">{fmt.date(h.now).replace(/\./g, "-")} {fmt.time(h.now, true)}</span>
          </div>
        </div>
        <div className="hero__art">
          <HeroArt />
          {f ? (
            <Link className="slip" to={`/capsules/${f.code}`} style={{ "--glow": paletteOf(f.code).glow } as CSSProperties}>
              <div className="slip__k">
                <span className="slip__dot" />
                广场上最受期待的一枚
              </div>
              <div className="slip__row">
                <CapsuleArt code={f.code} state="locked" width={64} />
                <div>
                  <b className="slip__t">{f.title}</b>
                  <span className="slip__cd mono">{cdShort(ms(f.openAt), h.now)}</span>
                </div>
              </div>
              <div className="slip__f">
                <Icon name="heart" />
                {fmt.num(f.favoriteCount)} 人在等它
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="container stats" aria-label="广场概览" data-testid="plaza-stats">
        {s ? (
          <>
            <StatCell i={0} k="all" n={s.counts.all} a="枚胶囊" b="在广场上" />
            <StatCell i={1} k="unopened" n={s.counts.unopened} a="枚正在" b="等待开启" />
            <StatCell i={2} k="opened" n={s.counts.opened} a="枚已经" b="被人读到" />
            {s.farthestOpenAt ? (
              <StatCell i={3} k="farthestYear" n={new Date(s.farthestOpenAt).getFullYear()} a="年，最远的" b="一枚才会打开" />
            ) : null}
          </>
        ) : null}
      </section>

      <section className="container plaza" id="plaza">
        <header className="page-head page-head--split">
          <div>
            <div className="eyebrow">Capsule Plaza</div>
            <h2 className="page-title">胶囊广场</h2>
            <p className="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
          </div>
          <CreateLink className="btn btn--primary">
            <Icon name="pen" />
            我也放一枚
          </CreateLink>
        </header>

        <div className="toolbar card">
          <label className={`search input-wrap${h.qInput ? " has-value" : ""}`}>
            <Icon name="search" className="input-wrap__icon" />
            <input
              ref={h.searchRef}
              className="input"
              type="search"
              placeholder="搜索标题或昵称…"
              maxLength={50}
              autoComplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              value={h.qInput}
              onChange={(e) => h.setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  h.setQInput("");
                  e.currentTarget.blur();
                }
              }}
            />
            <kbd className="kbd">/</kbd>
            <button className="search__x icon-btn" type="button" aria-label="清空搜索" onClick={h.clearSearch}>
              <Icon name="x" />
            </button>
          </label>
          <Seg<PlazaFilter>
            label="筛选"
            testId="filter-option"
            value={h.filter}
            onChange={h.setFilter}
            options={[
              { value: "all", label: "全部", count: h.counts?.all },
              { value: "unopened", label: "封存中", count: h.counts?.unopened },
              { value: "opened", label: "已开启", count: h.counts?.opened },
            ]}
          />
          <div className="select">
            <select aria-label="排序" data-testid="plaza-sort" value={h.sort} onChange={(e) => h.setSort(e.target.value as PlazaSort)}>
              <option value="new">最新封存</option>
              <option value="hot">最多收藏</option>
            </select>
            <Icon name="chev-down" className="select__arrow" />
          </div>
        </div>

        <div className="plaza__count">
          {p ? (
            <>
              共 <b>{fmt.num(p.total)}</b> 枚胶囊{h.q.trim() ? ` · 关键词「${h.q.trim()}」` : ""}
            </>
          ) : null}
        </div>

        <div className={`grid${h.loading && p ? " is-busy" : ""}`} aria-live="polite">
          {h.loading && !p ? (
            Array.from({ length: 6 }, (_, i) => <AmberCardSkeleton key={i} i={i} />)
          ) : h.error && !h.items.length ? (
            <EmptyBox
              testId="list-error"
              title="广场暂时打不开"
              text="没能连上后端。请确认服务已启动，或稍后再试。"
              action={
                <button className="btn btn--ghost" type="button" data-testid="list-retry" onClick={() => void h.refreshAll()}>
                  <Icon name="refresh" />
                  重试
                </button>
              }
            />
          ) : !h.items.length && p ? (
            h.q.trim() ? (
              <EmptyBox
                testId="list-empty"
                title={`没有找到「${h.q.trim()}」`}
                text="换个关键词试试，标题和昵称都可以搜。"
                action={
                  <button className="btn btn--ghost" type="button" onClick={h.clearSearch}>
                    清空搜索
                  </button>
                }
              />
            ) : (
              <EmptyBox
                testId="list-empty"
                title="广场上还没有胶囊"
                text="来当第一个写信给未来的人？"
                action={
                  <CreateLink className="btn btn--primary">
                    <Icon name="pen" />
                    写一枚胶囊
                  </CreateLink>
                }
              />
            )
          ) : (
            h.items.map((c, i) => (
              <AmberCard key={c.id} c={c} i={i} rank={h.rankOf(i)} mine={h.isMine(c.creator.nickname)} now={h.now} />
            ))
          )}
        </div>

        <nav className="pager" aria-label="分页">
          {p && p.totalPages > 1 && h.items.length ? (
            <>
              <button
                className="pager__btn"
                type="button"
                disabled={p.page <= 1}
                aria-label="上一页"
                onClick={() => {
                  h.setPage(p.page - 1);
                  scrollToPlaza();
                }}
              >
                <Icon name="chev-left" />
              </button>
              {pageNumbers(p.page, p.totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`g${i}`} className="pager__gap">…</span>
                ) : (
                  <button
                    key={n}
                    className={`pager__btn${n === p.page ? " is-active" : ""}`}
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
              <button
                className="pager__btn"
                type="button"
                disabled={p.page >= p.totalPages}
                aria-label="下一页"
                data-testid={p.page < p.totalPages ? "plaza-next" : undefined}
                onClick={() => {
                  h.setPage(p.page + 1);
                  scrollToPlaza();
                }}
              >
                <Icon name="chev-right" />
              </button>
            </>
          ) : null}
        </nav>
      </section>
    </div>
  );
}
