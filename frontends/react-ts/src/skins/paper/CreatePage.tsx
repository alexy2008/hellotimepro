// ============================================================
// 「时笺」创建页（/create）
// 左：一张红格信笺（标题 · AI 灵感 · 正文）
// 右：封缄台（时间标尺 + 日历 · 是否公开 · 信封预览 · 长按封缄）
// 完成后：封缄仪式 → 取信凭证（8 位胶囊码）
// 结构与类名照 2.0 原型 paper/view-create.js
// ============================================================

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { clamp, fmt, pad2, reducedMotion, sleep, focusIfIdle } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { useShare } from "@/hooks/useCapsule";
import { DAY, LIMITS, useCreateCapsule } from "@/hooks/useCreateCapsule";
import { useNow } from "@/hooks/useNow";
import type { CapsuleDetail } from "@/types";
import { AvatarStamp, Envelope, Postmark, Wax } from "./parts";

const MIN = 60000, HOUR = 3600000;

/* ---------- 时间标尺：对数刻度，从「此刻」到「十年」 ---------- */
const ANCHORS = [
  { ms: 2 * MIN, label: "此刻" },
  { ms: HOUR, label: "1 小时" },
  { ms: DAY, label: "1 天" },
  { ms: 7 * DAY, label: "1 周" },
  { ms: 30 * DAY, label: "1 个月" },
  { ms: 182 * DAY, label: "半年" },
  { ms: 365 * DAY, label: "1 年" },
  { ms: 1096 * DAY, label: "3 年" },
  { ms: 1826 * DAY, label: "5 年" },
  { ms: 3651 * DAY, label: "10 年" },
];
const SEGS = ANCHORS.length - 1;
const SEG_W = 124;
const STRIP_W = SEGS * SEG_W;

function vToMs(v: number) {
  const x = clamp(v, 0, 1) * SEGS;
  const i = Math.min(SEGS - 1, Math.floor(x));
  return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
}
function msToV(span: number) {
  const m = clamp(span, ANCHORS[0].ms, ANCHORS[SEGS].ms);
  for (let i = 0; i < SEGS; i++) {
    if (m <= ANCHORS[i + 1].ms) return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
  }
  return 1;
}
const minOpen = () => LIMITS.minOpen() + 30 * 1000;
const maxOpen = () => LIMITS.maxOpen();
const clampOpen = (t: number) => clamp(t, minOpen(), maxOpen());

/** 标尺拖出来的时长，按量级取整：越远越不需要精确到分钟 */
function roundOpen(span: number) {
  const d = new Date(Date.now() + span);
  if (span < HOUR) d.setSeconds(0, 0);
  else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
  else d.setHours(9, 0, 0, 0);
  return d.getTime();
}

const PRESETS = [
  { key: "1m", label: "1 分钟后", sub: "体验启封" },
  { key: "tm", label: "明早 9 点" },
  { key: "1mo", label: "1 个月后" },
  { key: "1y", label: "1 年后" },
  { key: "5y", label: "5 年后" },
  { key: "10y", label: "10 年后" },
];

const TICKS = (() => {
  const out: Array<{ left: number; cls: string; label?: string }> = [];
  for (let i = 0; i <= SEGS; i++) {
    out.push({ left: i * SEG_W, cls: "rt rt--major", label: ANCHORS[i].label });
    if (i < SEGS) for (let k = 1; k < 8; k++) out.push({ left: i * SEG_W + (k * SEG_W) / 8, cls: k === 4 ? "rt rt--mid" : "rt" });
  }
  return out;
})();

/** 抖一下：key 变化时加 is-shake 480ms */
function useShake(key: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 480);
    return () => clearTimeout(t);
  }, [key]);
  return on ? " is-shake" : "";
}

/* ---------- 日历：精确到分钟 ---------- */
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 日历底部的时 / 分输入：独立成组件，父组件每秒重绘时不会丢焦点 */
function TimeInput({ which, openAt, onCommit }: { which: "h" | "m"; openAt: number; onCommit: (which: "h" | "m", raw: string) => void }) {
  const cur = new Date(openAt);
  const [v, setV] = useState(pad2(which === "h" ? cur.getHours() : cur.getMinutes()));
  useEffect(() => {
    const d = new Date(openAt);
    setV(pad2(which === "h" ? d.getHours() : d.getMinutes()));
  }, [openAt, which]);
  return (
    <input
      className="cal__t mono"
      inputMode="numeric"
      maxLength={2}
      value={v}
      aria-label={which === "h" ? "小时" : "分钟"}
      onChange={(e) => setV(e.target.value)}
      onBlur={(e) => onCommit(which, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(which, e.currentTarget.value);
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const max = which === "h" ? 24 : 60;
        const step = (e.key === "ArrowUp" ? 1 : -1) * (which === "h" ? 1 : 5);
        onCommit(which, String(((parseInt(e.currentTarget.value, 10) || 0) + step + max) % max));
      }}
    />
  );
}

function Calendar({ openAt, onPick }: { openAt: number; onPick: (t: number) => void }) {
  const sel = new Date(openAt);
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const ringFor = useRef("");
  const selKey = `${sel.getFullYear()}-${sel.getMonth()}-${sel.getDate()}`;
  const fresh = ringFor.current !== selKey;
  useEffect(() => {
    ringFor.current = selKey;
  });
  // 外部（预设 / 标尺）改了日子，翻到那个月
  useEffect(() => setMonth(new Date(sel.getFullYear(), sel.getMonth(), 1)), [sel.getFullYear(), sel.getMonth()]);

  const y = month.getFullYear(), mo = month.getMonth();
  const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
  const today = new Date();
  const lo = new Date(minOpen());
  lo.setHours(0, 0, 0, 0);
  const hi = new Date(maxOpen());
  hi.setHours(23, 59, 59, 999);
  const nav = (n: number) => setMonth(new Date(y, mo + n, 1));
  const commitTime = (which: "h" | "m", raw: string) => {
    const cur = new Date(openAt);
    const n = clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
    if (which === "h") cur.setHours(n);
    else cur.setMinutes(n);
    onPick(cur.getTime());
  };
  return (
    <div className="cal">
      <div className="cal__head">
        <button className="cal__nav" type="button" aria-label="上一年" disabled={new Date(y - 1, mo + 1, 0) < lo} onClick={() => nav(-12)}>«</button>
        <button className="cal__nav" type="button" aria-label="上个月" disabled={new Date(y, mo, 0) < lo} onClick={() => nav(-1)}>‹</button>
        <div className="cal__title serif">
          <b className="latin">{y}</b> 年 <b className="latin">{mo + 1}</b> 月
        </div>
        <button className="cal__nav" type="button" aria-label="下个月" disabled={new Date(y, mo + 1, 1) > hi} onClick={() => nav(1)}>›</button>
        <button className="cal__nav" type="button" aria-label="下一年" disabled={new Date(y + 1, mo, 1) > hi} onClick={() => nav(12)}>»</button>
      </div>
      <div className="cal__dow">
        {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal__grid">
        {Array.from({ length: 42 }, (_, i) => {
          const d = new Date(y, mo, 1 - lead + i);
          const out = d.getMonth() !== mo, dis = d < lo || d > hi, isSel = sameDay(d, sel);
          return (
            <button
              key={i}
              type="button"
              className={`cal__d${out ? " is-out" : ""}${sameDay(d, today) ? " is-today" : ""}${isSel ? " is-sel" : ""}`}
              disabled={dis}
              aria-label={fmt.cn(d.getTime())}
              aria-current={isSel ? "date" : undefined}
              onClick={() => {
                const cur = new Date(openAt);
                d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
                onPick(d.getTime());
              }}
            >
              {d.getDate()}
              {isSel ? (
                <svg className={`cal__ring${fresh ? " is-draw" : ""}`} viewBox="0 0 40 40" aria-hidden="true">
                  <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6" />
                </svg>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="cal__time">
        <span className="cal__time-k">
          <Icon name="clock" />
          时刻
        </span>
        <TimeInput which="h" openAt={openAt} onCommit={commitTime} />
        <i>:</i>
        <TimeInput which="m" openAt={openAt} onCommit={commitTime} />
        <span className="cal__tz mono">{Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区"}</span>
      </div>
    </div>
  );
}

/* ---------- 封缄仪式 → 取信凭证 ---------- */
function Ceremony({ c, onAgain }: { c: CapsuleDetail; onAgain: () => void }) {
  const [cls, setCls] = useState("");
  const [env, setEnv] = useState(" is-open is-rising");
  const first = useRef<HTMLButtonElement>(null);
  const { copyCode, copyLink } = useShare(c.code);
  const openAt = new Date(c.openAt).getTime();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const q = reducedMotion();
      await sleep(30);
      if (!alive) return;
      setCls(" is-in");
      await sleep(q ? 0 : 520);
      setEnv(" is-open"); // 信纸落进信封
      await sleep(q ? 0 : 760);
      setEnv(""); // 封舌合上
      await sleep(q ? 0 : 780);
      setCls(" is-in is-stamped"); // 火漆落下
      await sleep(q ? 0 : 720);
      if (!alive) return;
      setCls(" is-in is-stamped is-done"); // 凭证滑出
      first.current?.focus({ preventScroll: true });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return createPortal(
    <div className={`cer${cls}`} role="dialog" aria-modal="true" aria-label="封缄完成" data-testid="sealed-receipt" data-code={c.code}>
      <div className="cer__bg" />
      <div className="cer__in">
        <div className="cer__stage">
          <Envelope
            className={`env--cer${env}`}
            letter={
              <>
                <b>{c.title}</b>
                <i />
                <i />
                <i />
                <i />
              </>
            }
          />
        </div>
        <div className="rcpt">
          <div className="rcpt__k">
            <span>封缄完成</span>
            <i />
            <span className="latin">Sealed</span>
          </div>
          <h2 className="rcpt__t serif">《{c.title}》</h2>
          <p className="rcpt__w">
            将于 <b>{fmt.full(openAt)}</b> 启封
            <br />
            还要等 {fmt.span(openAt - Date.now())}
          </p>
          <div className="rcpt__code mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
            {Array.from(c.code).map((ch, i) => (
              <span key={i} style={{ display: "contents" }}>
                <span style={{ "--i": i } as CSSProperties}>{ch}</span>
                {i === 3 ? <i /> : null}
              </span>
            ))}
          </div>
          <p className="rcpt__hint">
            这 8 位胶囊码是开启它的凭证。{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}
          </p>
          <div className="rcpt__act">
            <button ref={first} className="btn btn--primary" type="button" data-testid="copy-code" onClick={copyCode}>
              <Icon name="copy" />
              复制胶囊码
            </button>
            <button className="btn btn--ghost" type="button" data-testid="copy-link" onClick={copyLink}>
              <Icon name="link" />
              复制分享链接
            </button>
          </div>
          <div className="rcpt__more">
            <Link to={`/capsules/${c.code}`} data-testid="receipt-view">
              查看这枚胶囊
              <Icon name="arrow" />
            </Link>
            <button className="linkbtn" type="button" data-testid="receipt-again" onClick={onAgain}>
              <Icon name="pen" />
              再写一枚
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PaperCreatePage() {
  const me = useAuth((s) => s.user)!;
  const f = useCreateCapsule();
  const now = useNow();
  const [calOpen, setCalOpen] = useState(false);
  const ruler = useRef<HTMLDivElement>(null);
  const needle = useRef<HTMLDivElement>(null);
  const titleEl = useRef<HTMLInputElement>(null);
  const contentEl = useRef<HTMLTextAreaElement>(null);
  const [drag, setDrag] = useState(false);
  const [glide, setGlide] = useState(false);
  const [dragV, setDragV] = useState<number | null>(null);
  const titleShake = useShake(f.shake.title);
  const contentShake = useShake(f.shake.content);
  const openShake = useShake(f.shake.openAt);

  // 标尺位置：拖动时用拖出来的 v，松手后对齐到取整后的时刻
  const v = dragV ?? msToV(f.openAt - now);
  const span = f.openAt - now;

  useEffect(() => {
    const t = setTimeout(() => focusIfIdle(titleEl.current), 420);
    return () => clearTimeout(t);
  }, []);

  // 正文框随内容长高
  useLayoutEffect(() => {
    const el = contentEl.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 34 * 9) + "px";
  }, [f.content]);

  // 校验失败：把出错的字段滚到眼前并聚焦
  useEffect(() => {
    const el = f.errors.title ? titleEl.current : f.errors.content ? contentEl.current : null;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
  }, [f.shake.title, f.shake.content]);

  const setFromV = (nv: number) => {
    setDragV(clamp(nv, 0, 1));
    setGlide(false);
    f.setOpenAt(clampOpen(roundOpen(vToMs(clamp(nv, 0, 1)))));
  };
  const lastTick = useRef(-1);
  const tickFx = (nv: number) => {
    const idx = Math.round(nv * SEGS * 8);
    if (idx !== lastTick.current && needle.current?.animate && !reducedMotion()) {
      needle.current.animate([{ transform: "translateX(-50%) scaleY(1.14)" }, { transform: "translateX(-50%) scaleY(1)" }], { duration: 150, easing: "ease-out" });
    }
    lastTick.current = idx;
  };

  /* ---------- 长按封缄 ---------- */
  const HOLD_MS = 1150;
  const hold = useRef<HTMLButtonElement>(null);
  const [holdState, setHoldState] = useState<"" | "holding" | "done">("");
  const [hint, setHint] = useState("长按火漆，封缄");
  const holding = useRef(false);
  const raf = useRef(0);
  const t0 = useRef(0);
  const [quickKey, setQuickKey] = useState(0);
  const holdShake = useShake(quickKey);

  const timer = useRef(0);
  /** 完成由定时器驱动（后台标签页里 rAF 会停），rAF 只负责画进度环 */
  const frame = (t: number) => {
    if (!holding.current) return;
    hold.current?.style.setProperty("--hp", clamp((t - t0.current) / HOLD_MS, 0, 1).toFixed(3));
    raf.current = requestAnimationFrame(frame);
  };
  const complete = () => {
    if (!holding.current) return;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    hold.current?.style.setProperty("--hp", "1");
    setHoldState("done");
    void f.submit().then((c) => {
      if (!c) {
        setHoldState("");
        setHint("长按火漆，封缄");
        hold.current?.style.setProperty("--hp", "0");
      }
    });
  };
  const startHold = () => {
    if (holding.current || holdState === "done") return;
    if (!f.validate()) return;
    holding.current = true;
    t0.current = performance.now();
    setHoldState("holding");
    setHint("按住，别松手…");
    raf.current = requestAnimationFrame(frame);
    timer.current = window.setTimeout(complete, HOLD_MS);
  };
  const cancelHold = () => {
    if (!holding.current) return;
    const quick = performance.now() - t0.current < 320;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
    setHoldState("");
    hold.current?.style.setProperty("--hp", "0");
    setHint(quick ? "要按住约 1 秒才会封缄" : "长按火漆，封缄");
    if (quick) setQuickKey((k) => k + 1);
  };
  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
  }, []);

  const titleN = Array.from(f.title).length;

  return (
    <div className="page page--create">
      <div className="wrap create">
        <header className="pagehead">
          <div>
            <div className="overline">
              <i />
              New capsule
            </div>
            <h1 className="h1">写给未来的信</h1>
          </div>
          <p className="lede">
            这段文字会被封存，直到你设定的时刻，
            <br />
            才能被任何人——包括你自己——打开。
          </p>
        </header>

        <div className="create__grid">
          {/* ============ 信笺 ============ */}
          <section className={`sheet${f.aiBusy ? " is-ai" : ""}${f.aiThinking ? " is-thinking" : ""}`} aria-label="信的内容">
            <div className="sheet__head">
              <span className="sheet__to">致 未来 ——</span>
              <button
                className={`aibtn${f.aiBusy ? " is-busy" : ""}`}
                type="button"
                data-testid="ai-generate"
                title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题"
                onClick={() => void f.aiWrite()}
              >
                <Icon name="sparkle" />
                <span>{f.aiBusy ? "代笔中…" : f.aiDone ? "重新代笔" : "AI 代笔"}</span>
              </button>
            </div>

            <div className={`sheet__title${titleShake}`}>
              <input
                ref={titleEl}
                type="text"
                maxLength={60}
                autoComplete="off"
                placeholder="给这封信起个标题"
                aria-label="标题，最多 60 字"
                data-testid="create-title"
                value={f.title}
                onChange={(e) => f.setTitle(e.target.value)}
              />
              <span className="sheet__n mono">
                <b>{titleN}</b>/60
              </span>
            </div>
            <div className="sheet__err" role="alert" data-testid={f.errors.title ? "field-error" : undefined} data-field="title">
              {f.errors.title}
            </div>

            <div className={`recos${f.showRecos ? "" : " is-hidden"}`} data-testid={f.showRecos ? "ai-reco" : undefined}>
              <div className="recos__in">
                <div className="recos__head">
                  <span>
                    <Icon name="sparkle" />
                    没有头绪？从一个灵感开始
                  </span>
                  <button className="linkbtn" type="button" data-testid="reco-refresh" disabled={f.recoBusy || f.aiBusy} onClick={() => void f.refreshRecos()}>
                    <Icon name="refresh" />
                    {f.recoBusy ? "换一批中…" : "换一批"}
                  </button>
                </div>
                <div className="recos__list">
                  {f.recos.map((r, i) => (
                    <button
                      key={r.title}
                      className="reco"
                      type="button"
                      style={{ "--i": i } as CSSProperties}
                      data-testid="reco-chip"
                      disabled={f.aiBusy}
                      onClick={() => void f.aiWrite(r.title)}
                    >
                      <b>{r.title}</b>
                      <span>{r.hint}</span>
                      <em>{fmt.span(r.openInDays * DAY)}后</em>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`sheet__body${contentShake}`}>
              <textarea
                ref={contentEl}
                maxLength={5000}
                rows={9}
                aria-label="正文，最多 5000 字"
                placeholder={"在这里写下想传到未来的话。\n可以是此刻的天气、正在读的书、一个小小的许诺，\n或者只是一句：嘿，你还好吗？"}
                data-testid="create-content"
                value={f.content}
                onChange={(e) => f.setContent(e.target.value)}
              />
              <div className="sheet__think" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="sheet__err" role="alert" data-testid={f.errors.content ? "field-error" : undefined} data-field="content">
              {f.errors.content}
            </div>

            <div className="sheet__foot">
              <span className="sheet__ainote">
                {f.aiNote ? (
                  <>
                    <Icon name="sparkle" />
                    {f.aiNote}
                  </>
                ) : null}
              </span>
              <span className="sheet__n mono">
                <b>{fmt.num(f.content.length)}</b> / 5000
              </span>
            </div>

            <div className="sheet__sign">
              <span>——</span>
              <Avatar id={me.avatarId} />
              <b>{me.nickname}</b>
              <span className="sheet__date">
                {fmt.cn(now)} {fmt.week(now)}
              </span>
            </div>
          </section>

          {/* ============ 封缄台 ============ */}
          <aside className="desk" aria-label="封缄设置">
            <section className={`panel${openShake}`}>
              <h2 className="panel__h">
                <span className="panel__no">壹</span>启封时刻
              </h2>

              <div className="presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`chip${f.preset === p.key ? " is-active" : ""}`}
                    type="button"
                    data-testid="openat-preset"
                    data-value={p.key}
                    data-selected={f.preset === p.key}
                    onClick={() => {
                      setDragV(null);
                      setGlide(true);
                      f.pickPreset(p.key);
                    }}
                  >
                    {p.label}
                    {p.sub ? <small>{p.sub}</small> : null}
                  </button>
                ))}
              </div>

              <div
                ref={ruler}
                className={`ruler${drag ? " is-drag" : ""}${glide ? " is-glide" : ""}`}
                tabIndex={0}
                role="slider"
                aria-label="启封距离：左右拖动或用方向键调整"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(v * 100)}
                aria-valuetext={`${fmt.span(span)}后，${fmt.full(f.openAt)}`}
                onPointerDown={(e) => {
                  if (e.button) return;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const x0 = e.clientX, v0 = v;
                  let moved = false;
                  setDrag(true);
                  const el = e.currentTarget;
                  const move = (ev: PointerEvent) => {
                    const dx = ev.clientX - x0;
                    if (Math.abs(dx) > 3) moved = true;
                    if (!moved) return;
                    const nv = v0 - dx / STRIP_W;
                    setFromV(nv);
                    tickFx(nv);
                  };
                  const up = (ev: PointerEvent) => {
                    setDrag(false);
                    el.removeEventListener("pointermove", move);
                    el.removeEventListener("pointerup", up);
                    el.removeEventListener("pointercancel", up);
                    if (!moved && ev.type === "pointerup") {
                      const r = el.getBoundingClientRect();
                      setFromV(v0 + (ev.clientX - (r.left + r.width / 2)) / STRIP_W);
                    }
                    setDragV(null); // 松手后对齐到取整后的时刻
                    setGlide(true);
                  };
                  el.addEventListener("pointermove", move);
                  el.addEventListener("pointerup", up);
                  el.addEventListener("pointercancel", up);
                }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 0.02 : 0.004;
                  let nv: number | null = null;
                  if (e.key === "ArrowLeft" || e.key === "ArrowDown") nv = v - step;
                  else if (e.key === "ArrowRight" || e.key === "ArrowUp") nv = v + step;
                  else if (e.key === "PageDown") nv = (Math.ceil(v * SEGS - 0.001) - 1) / SEGS;
                  else if (e.key === "PageUp") nv = (Math.floor(v * SEGS + 0.001) + 1) / SEGS;
                  else if (e.key === "Home") nv = 0;
                  else if (e.key === "End") nv = 1;
                  if (nv == null) return;
                  e.preventDefault();
                  setFromV(nv);
                  tickFx(nv);
                  setDragV(null);
                }}
              >
                <div className="ruler__strip" style={{ transform: `translateX(${(-v * STRIP_W).toFixed(1)}px)` }}>
                  {TICKS.map((t, i) => (
                    <i key={i} className={t.cls} style={{ left: t.left }}>
                      {t.label ? <b>{t.label}</b> : null}
                    </i>
                  ))}
                </div>
                <div className="ruler__needle" ref={needle} />
              </div>

              <div className="when">
                <div className="when__rel serif">{fmt.span(span)}后</div>
                <div className="when__abs" data-testid="create-openat" data-value={new Date(f.openAt).toISOString()}>
                  {fmt.full(f.openAt)}
                </div>
                <button
                  className={`linkbtn when__more${calOpen ? " is-open" : ""}`}
                  type="button"
                  aria-expanded={calOpen}
                  onClick={() => setCalOpen((o) => !o)}
                >
                  <Icon name="calendar" />
                  <span>精确到分钟</span>
                  <Icon name="chev-down" className="ic--chev" />
                </button>
              </div>
              <div className="sheet__err" role="alert" data-testid={f.errors.openAt ? "field-error" : undefined} data-field="openAt">
                {f.errors.openAt}
              </div>

              <div className={`calwrap${calOpen ? " is-open" : ""}`}>
                <div className="calwrap__in">
                  {calOpen ? (
                    <Calendar
                      openAt={f.openAt}
                      onPick={(t) => {
                        setDragV(null);
                        setGlide(true);
                        f.setOpenAt(clampOpen(t));
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </section>

            <section className="panel">
              <h2 className="panel__h">
                <span className="panel__no">贰</span>寄往广场
              </h2>
              <label className="switch">
                <input type="checkbox" checked={f.inPlaza} data-testid="create-in-plaza" onChange={(e) => f.setInPlaza(e.target.checked)} />
                <span className="switch__track">
                  <i />
                </span>
                <span className="switch__text">
                  <b>{f.inPlaza ? "发布到胶囊广场" : "只凭胶囊码可见"}</b>
                  <small>{f.inPlaza ? "所有人能看到标题与倒计时；正文在启封后公开。" : "不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。"}</small>
                </span>
              </label>
            </section>

            <section className="panel panel--seal">
              <h2 className="panel__h">
                <span className="panel__no">叁</span>封缄
              </h2>
              <div className={`envf${f.inPlaza ? "" : " is-private"}`} aria-hidden="true">
                <div className="envf__stamp">
                  <AvatarStamp id={me.avatarId} className="stamp--sm" label={false} />
                </div>
                <div className="envf__pm">
                  <Postmark line1={fmt.date(f.openAt)} line2={`${fmt.time(f.openAt)} 启`} className="pm--envf" />
                </div>
                <div className="envf__to">
                  <small>寄往</small>
                  <b>{fmt.cn(f.openAt)}</b>
                  <span>{fmt.span(span)}后的未来</span>
                </div>
                <div className="envf__title serif">{f.title.trim() ? `《${f.title.trim()}》` : "《未命名的信》"}</div>
                <div className="envf__from mono">
                  <span>
                    自 {fmt.date(now)} · {me.nickname}
                  </span>
                  <span>{f.inPlaza ? "广场公开" : "仅凭码可见"}</span>
                </div>
              </div>

              <div className="hold-row">
                <button
                  ref={hold}
                  className={`hold${holdState === "holding" ? " is-holding" : ""}${holdState === "done" ? " is-done" : ""}${holdShake}`}
                  type="button"
                  aria-describedby="holdHint"
                  data-testid="create-submit"
                  onPointerDown={(e) => {
                    if (e.button) return;
                    e.preventDefault();
                    e.currentTarget.focus({ preventScroll: true });
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* 某些浏览器在合成事件里不允许捕获 */
                    }
                    startHold();
                  }}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onLostPointerCapture={cancelHold}
                  onKeyDown={(e) => {
                    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                      e.preventDefault();
                      startHold();
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === " " || e.key === "Enter") cancelHold();
                  }}
                  onBlur={cancelHold}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <svg className="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle className="hold__track" cx="60" cy="60" r="56" />
                    <circle className="hold__prog" cx="60" cy="60" r="56" pathLength={100} />
                  </svg>
                  <Wax ch="封" className="hold__wax" />
                  <span className="sr-only">长按封缄</span>
                </button>
                <div className="hold-copy">
                  <b id="holdHint">{f.submitting ? "正在封缄…" : hint}</b>
                  <p>
                    封缄后不可修改、不可提前开启；
                    <br />
                    可以在「我创建的」里删除。
                  </p>
                  <p className="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      {f.created ? (
        <Ceremony
          c={f.created}
          onAgain={() => {
            f.again();
            setHoldState("");
            setHint("长按火漆，封缄");
            hold.current?.style.setProperty("--hp", "0");
            titleEl.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </div>
  );
}
