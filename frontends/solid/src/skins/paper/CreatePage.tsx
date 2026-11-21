// ============================================================
// 「时笺」创建页（/create）
// 左：一张红格信笺（标题 · AI 灵感 · 正文）
// 右：封缄台（时间标尺 + 日历 · 是否公开 · 信封预览 · 长按封缄）
// 完成后：封缄仪式 → 取信凭证（8 位胶囊码）
// 结构与类名照 2.0 原型 paper/view-create.js
// ============================================================

import { For, Index, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { clamp, fmt, focusIfIdle, pad2, reducedMotion, sleep } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { auth } from "@/stores/auth";
import { Avatar } from "@/components/shared";
import { createShake } from "@/components/forms";
import { shareOf } from "@/primitives/capsule";
import { DAY, LIMITS, type CapsuleForm } from "@/primitives/capsuleForm";
import { useNow } from "@/primitives/now";
import type { CapsuleDetail } from "@/types";
import { AvatarStamp, Envelope, LetterSlip, Postmark, Wax } from "./parts";

const MIN = 60000,
  HOUR = 3600000;

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

/* ---------- 日历：精确到分钟 ---------- */
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** 日历底部的时 / 分输入：自己记着正在敲的字，回车或失焦时才提交 */
function TimeInput(props: { which: "h" | "m"; openAt: number; onCommit: (which: "h" | "m", raw: string) => void }) {
  const part = () => {
    const d = new Date(props.openAt);
    return pad2(props.which === "h" ? d.getHours() : d.getMinutes());
  };
  const [v, setV] = createSignal(part());
  createEffect(on(part, (x) => setV(x), { defer: true }));
  return (
    <input
      class="cal__t mono"
      inputMode="numeric"
      maxLength={2}
      value={v()}
      aria-label={props.which === "h" ? "小时" : "分钟"}
      onInput={(e) => setV(e.currentTarget.value)}
      onBlur={(e) => props.onCommit(props.which, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.onCommit(props.which, e.currentTarget.value);
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const max = props.which === "h" ? 24 : 60;
        const step = (e.key === "ArrowUp" ? 1 : -1) * (props.which === "h" ? 1 : 5);
        props.onCommit(props.which, String(((parseInt(e.currentTarget.value, 10) || 0) + step + max) % max));
      }}
    />
  );
}

function Calendar(props: { openAt: number; onPick: (t: number) => void }) {
  const sel = () => new Date(props.openAt);
  const [month, setMonth] = createSignal(new Date(sel().getFullYear(), sel().getMonth(), 1));
  const selKey = createMemo(() => `${sel().getFullYear()}-${sel().getMonth()}-${sel().getDate()}`);
  // 选中的日子变了才画那一圈墨（翻月不重画）：ringFor 记着上一次画圈时的日子；刚展开日历时也画
  let ringFor = "";
  createEffect(() => (ringFor = selKey()));
  // 外部（预设 / 标尺）改了日子，翻到那个月
  createEffect(
    on(
      () => `${sel().getFullYear()}-${sel().getMonth()}`,
      () => setMonth(new Date(sel().getFullYear(), sel().getMonth(), 1)),
      { defer: true },
    ),
  );

  const y = () => month().getFullYear();
  const mo = () => month().getMonth();
  const days = createMemo(() => {
    const lead = (new Date(y(), mo(), 1).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => new Date(y(), mo(), 1 - lead + i));
  });
  const today = new Date();
  const lo = () => {
    const d = new Date(minOpen());
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const hi = () => {
    const d = new Date(maxOpen());
    d.setHours(23, 59, 59, 999);
    return d;
  };
  const nav = (n: number) => setMonth(new Date(y(), mo() + n, 1));
  const commitTime = (which: "h" | "m", raw: string) => {
    const cur = new Date(props.openAt);
    const n = clamp(parseInt(raw, 10) || 0, 0, which === "h" ? 23 : 59);
    if (which === "h") cur.setHours(n);
    else cur.setMinutes(n);
    props.onPick(cur.getTime());
  };
  return (
    <div class="cal">
      <div class="cal__head">
        <button class="cal__nav" type="button" aria-label="上一年" disabled={new Date(y() - 1, mo() + 1, 0) < lo()} onClick={() => nav(-12)}>
          «
        </button>
        <button class="cal__nav" type="button" aria-label="上个月" disabled={new Date(y(), mo(), 0) < lo()} onClick={() => nav(-1)}>
          ‹
        </button>
        <div class="cal__title serif">
          <b class="latin">{y()}</b> 年 <b class="latin">{mo() + 1}</b> 月
        </div>
        <button class="cal__nav" type="button" aria-label="下个月" disabled={new Date(y(), mo() + 1, 1) > hi()} onClick={() => nav(1)}>
          ›
        </button>
        <button class="cal__nav" type="button" aria-label="下一年" disabled={new Date(y() + 1, mo(), 1) > hi()} onClick={() => nav(12)}>
          »
        </button>
      </div>
      <div class="cal__dow">
        <For each={["一", "二", "三", "四", "五", "六", "日"]}>{(w) => <span>{w}</span>}</For>
      </div>
      <div class="cal__grid">
        <Index each={days()}>
          {(d) => {
            const isSel = () => sameDay(d(), sel());
            return (
              <button
                type="button"
                class={`cal__d${d().getMonth() !== mo() ? " is-out" : ""}${sameDay(d(), today) ? " is-today" : ""}${isSel() ? " is-sel" : ""}`}
                disabled={d() < lo() || d() > hi()}
                aria-label={fmt.cn(d().getTime())}
                aria-current={isSel() ? "date" : undefined}
                onClick={() => {
                  const cur = new Date(props.openAt);
                  const t = new Date(d());
                  t.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
                  props.onPick(t.getTime());
                }}
              >
                {d().getDate()}
                <Show when={isSel()}>
                  <svg class={`cal__ring${ringFor !== selKey() ? " is-draw" : ""}`} viewBox="0 0 40 40" aria-hidden="true">
                    <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6" />
                  </svg>
                </Show>
              </button>
            );
          }}
        </Index>
      </div>
      <div class="cal__time">
        <span class="cal__time-k">
          <Icon name="clock" />
          时刻
        </span>
        <TimeInput which="h" openAt={props.openAt} onCommit={commitTime} />
        <i>:</i>
        <TimeInput which="m" openAt={props.openAt} onCommit={commitTime} />
        <span class="cal__tz mono">{Intl.DateTimeFormat().resolvedOptions().timeZone || "本地时区"}</span>
      </div>
    </div>
  );
}

/* ---------- 封缄仪式 → 取信凭证 ---------- */
function Ceremony(props: { c: CapsuleDetail; onAgain: () => void }) {
  const c = props.c;
  const [cls, setCls] = createSignal("");
  const [env, setEnv] = createSignal(" is-open is-rising");
  let first: HTMLButtonElement | undefined;
  const { copyCode, copyLink } = shareOf(c.code);
  const openAt = new Date(c.openAt).getTime();

  onMount(() => {
    let alive = true;
    onCleanup(() => (alive = false));
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
      first?.focus({ preventScroll: true });
    })();
  });

  // Portal 把仪式层挂到 <body> 下，逃出页面里带 transform 的祖先，position: fixed 才能铺满视口
  return (
    <Portal>
      <div class={`cer${cls()}`} role="dialog" aria-modal="true" aria-label="封缄完成" data-testid="sealed-receipt" data-code={c.code}>
        <div class="cer__bg" />
        <div class="cer__in">
          <div class="cer__stage">
            <Envelope class={`env--cer${env()}`} letter={<LetterSlip title={c.title} />} />
          </div>
          <div class="rcpt">
            <div class="rcpt__k">
              <span>封缄完成</span>
              <i />
              <span class="latin">Sealed</span>
            </div>
            <h2 class="rcpt__t serif">《{c.title}》</h2>
            <p class="rcpt__w">
              将于 <b>{fmt.full(openAt)}</b> 启封
              <br />
              还要等 {fmt.span(openAt - Date.now())}
            </p>
            <div class="rcpt__code mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
              <Index each={Array.from(c.code)}>
                {(ch, i) => (
                  <>
                    <span style={{ "--i": i }}>{ch()}</span>
                    <Show when={i === 3}>
                      <i />
                    </Show>
                  </>
                )}
              </Index>
            </div>
            <p class="rcpt__hint">
              这 8 位胶囊码是开启它的凭证。{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}
            </p>
            <div class="rcpt__act">
              <button ref={first} class="btn btn--primary" type="button" data-testid="copy-code" onClick={copyCode}>
                <Icon name="copy" />
                复制胶囊码
              </button>
              <button class="btn btn--ghost" type="button" data-testid="copy-link" onClick={copyLink}>
                <Icon name="link" />
                复制分享链接
              </button>
            </div>
            <div class="rcpt__more">
              <a href={`/capsules/${c.code}`} data-testid="receipt-view">
                查看这枚胶囊
                <Icon name="arrow" />
              </a>
              <button class="linkbtn" type="button" data-testid="receipt-again" onClick={() => props.onAgain()}>
                <Icon name="pen" />
                再写一枚
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

export function PaperCreatePage(props: { f: CapsuleForm }) {
  const f = props.f;
  const d = f.draft;
  const me = () => auth.user!;
  const now = useNow();
  const [calOpen, setCalOpen] = createSignal(false);
  let needle: HTMLDivElement | undefined;
  let titleEl: HTMLInputElement | undefined;
  let contentEl: HTMLTextAreaElement | undefined;
  const [drag, setDrag] = createSignal(false);
  const [glide, setGlide] = createSignal(false);
  const [dragV, setDragV] = createSignal<number | null>(null);
  const titleShake = createShake(() => f.shake.title);
  const contentShake = createShake(() => f.shake.content);
  const openShake = createShake(() => f.shake.openAt);

  // 标尺位置：拖动时用拖出来的 v，松手后对齐到取整后的时刻
  const span = () => d.openAt - now();
  const v = () => dragV() ?? msToV(span());

  onMount(() => {
    const t = setTimeout(() => focusIfIdle(titleEl), 420);
    onCleanup(() => clearTimeout(t));
  });

  // 正文框随内容长高
  createEffect(
    on(
      () => d.content,
      () => {
        if (!contentEl) return;
        contentEl.style.height = "auto";
        contentEl.style.height = Math.max(contentEl.scrollHeight, 34 * 9) + "px";
      },
    ),
  );

  // 校验失败：把出错的字段滚到眼前并聚焦
  createEffect(
    on(
      () => [f.shake.title, f.shake.content],
      () => {
        const el = f.errors.title ? titleEl : f.errors.content ? contentEl : null;
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      },
      { defer: true },
    ),
  );

  const setFromV = (nv: number) => {
    setDragV(clamp(nv, 0, 1));
    setGlide(false);
    f.setOpenAt(clampOpen(roundOpen(vToMs(clamp(nv, 0, 1)))));
  };
  let lastTick = -1;
  const tickFx = (nv: number) => {
    const idx = Math.round(nv * SEGS * 8);
    if (idx !== lastTick && needle?.animate && !reducedMotion()) {
      needle.animate([{ transform: "translateX(-50%) scaleY(1.14)" }, { transform: "translateX(-50%) scaleY(1)" }], { duration: 150, easing: "ease-out" });
    }
    lastTick = idx;
  };

  const onRulerDown = (e: PointerEvent & { currentTarget: HTMLDivElement }) => {
    if (e.button) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX,
      v0 = v();
    let moved = false;
    setDrag(true);
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
  };

  const onRulerKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.02 : 0.004;
    const cur = v();
    let nv: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") nv = cur - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") nv = cur + step;
    else if (e.key === "PageDown") nv = (Math.ceil(cur * SEGS - 0.001) - 1) / SEGS;
    else if (e.key === "PageUp") nv = (Math.floor(cur * SEGS + 0.001) + 1) / SEGS;
    else if (e.key === "Home") nv = 0;
    else if (e.key === "End") nv = 1;
    if (nv == null) return;
    e.preventDefault();
    setFromV(nv);
    tickFx(nv);
    setDragV(null);
  };

  /* ---------- 长按封缄 ---------- */
  const HOLD_MS = 1150;
  let hold: HTMLButtonElement | undefined;
  const [holdState, setHoldState] = createSignal<"" | "holding" | "done">("");
  const [hint, setHint] = createSignal("长按火漆，封缄");
  let holding = false;
  let raf = 0;
  let t0 = 0;
  let timer = 0;
  const [quickKey, setQuickKey] = createSignal(0);
  const holdShake = createShake(quickKey);
  const setHp = (v: string) => hold?.style.setProperty("--hp", v);

  /** 完成由定时器驱动（后台标签页里 rAF 会停），rAF 只负责画进度环 */
  const frame = (t: number) => {
    if (!holding) return;
    setHp(clamp((t - t0) / HOLD_MS, 0, 1).toFixed(3));
    raf = requestAnimationFrame(frame);
  };
  const complete = () => {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    setHp("1");
    setHoldState("done");
    void f.submit().then((c) => {
      if (!c) {
        setHoldState("");
        setHint("长按火漆，封缄");
        setHp("0");
      }
    });
  };
  const startHold = () => {
    if (holding || holdState() === "done") return;
    if (!f.validate()) return;
    holding = true;
    t0 = performance.now();
    setHoldState("holding");
    setHint("按住，别松手…");
    raf = requestAnimationFrame(frame);
    timer = window.setTimeout(complete, HOLD_MS);
  };
  const cancelHold = () => {
    if (!holding) return;
    const quick = performance.now() - t0 < 320;
    holding = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    setHoldState("");
    setHp("0");
    setHint(quick ? "要按住约 1 秒才会封缄" : "长按火漆，封缄");
    if (quick) setQuickKey((k) => k + 1);
  };
  onCleanup(() => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  });

  const titleN = () => Array.from(d.title).length;

  return (
    <div class="page page--create">
      <div class="wrap create">
        <header class="pagehead">
          <div>
            <div class="overline">
              <i />
              New capsule
            </div>
            <h1 class="h1">写给未来的信</h1>
          </div>
          <p class="lede">
            这段文字会被封存，直到你设定的时刻，
            <br />
            才能被任何人——包括你自己——打开。
          </p>
        </header>

        <div class="create__grid">
          {/* ============ 信笺 ============ */}
          <section class={`sheet${f.aiBusy() ? " is-ai" : ""}${f.aiThinking() ? " is-thinking" : ""}`} aria-label="信的内容">
            <div class="sheet__head">
              <span class="sheet__to">致 未来 ——</span>
              <button
                class={`aibtn${f.aiBusy() ? " is-busy" : ""}`}
                type="button"
                data-testid="ai-generate"
                title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题"
                onClick={() => void f.aiWrite()}
              >
                <Icon name="sparkle" />
                <span>{f.aiBusy() ? "代笔中…" : f.aiDone() ? "重新代笔" : "AI 代笔"}</span>
              </button>
            </div>

            <div class={`sheet__title${titleShake()}`}>
              <input
                ref={titleEl}
                type="text"
                maxLength={60}
                autocomplete="off"
                placeholder="给这封信起个标题"
                aria-label="标题，最多 60 字"
                data-testid="create-title"
                value={d.title}
                onInput={(e) => f.setTitle(e.currentTarget.value)}
              />
              <span class="sheet__n mono">
                <b>{titleN()}</b>/60
              </span>
            </div>
            <div class="sheet__err" role="alert" data-testid={f.errors.title ? "field-error" : undefined} data-field="title">
              {f.errors.title}
            </div>

            <div class={`recos${f.showRecos() ? "" : " is-hidden"}`} data-testid={f.showRecos() ? "ai-reco" : undefined}>
              <div class="recos__in">
                <div class="recos__head">
                  <span>
                    <Icon name="sparkle" />
                    没有头绪？从一个灵感开始
                  </span>
                  <button class="linkbtn" type="button" data-testid="reco-refresh" disabled={f.recoBusy() || f.aiBusy()} onClick={() => void f.refreshRecos()}>
                    <Icon name="refresh" />
                    {f.recoBusy() ? "换一批中…" : "换一批"}
                  </button>
                </div>
                <div class="recos__list">
                  <For each={f.recos()}>
                    {(r, i) => (
                      <button class="reco" type="button" style={{ "--i": i() }} data-testid="reco-chip" disabled={f.aiBusy()} onClick={() => void f.aiWrite(r.title)}>
                        <b>{r.title}</b>
                        <span>{r.hint}</span>
                        <em>{fmt.span(r.openInDays * DAY)}后</em>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            <div class={`sheet__body${contentShake()}`}>
              <textarea
                ref={contentEl}
                maxLength={5000}
                rows={9}
                aria-label="正文，最多 5000 字"
                placeholder={"在这里写下想传到未来的话。\n可以是此刻的天气、正在读的书、一个小小的许诺，\n或者只是一句：嘿，你还好吗？"}
                data-testid="create-content"
                value={d.content}
                onInput={(e) => f.setContent(e.currentTarget.value)}
              />
              <div class="sheet__think" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div class="sheet__err" role="alert" data-testid={f.errors.content ? "field-error" : undefined} data-field="content">
              {f.errors.content}
            </div>

            <div class="sheet__foot">
              <span class="sheet__ainote">
                <Show when={f.aiNote()}>
                  <Icon name="sparkle" />
                  {f.aiNote()}
                </Show>
              </span>
              <span class="sheet__n mono">
                <b>{fmt.num(d.content.length)}</b> / 5000
              </span>
            </div>

            <div class="sheet__sign">
              <span>——</span>
              <Avatar id={me().avatarId} />
              <b>{me().nickname}</b>
              <span class="sheet__date">
                {fmt.cn(now())} {fmt.week(now())}
              </span>
            </div>
          </section>

          {/* ============ 封缄台 ============ */}
          <aside class="desk" aria-label="封缄设置">
            <section class={`panel${openShake()}`}>
              <h2 class="panel__h">
                <span class="panel__no">壹</span>启封时刻
              </h2>

              <div class="presets">
                <For each={PRESETS}>
                  {(p) => (
                    <button
                      class={`chip${d.preset === p.key ? " is-active" : ""}`}
                      type="button"
                      data-testid="openat-preset"
                      data-value={p.key}
                      data-selected={String(d.preset === p.key)}
                      onClick={() => {
                        setDragV(null);
                        setGlide(true);
                        f.pickPreset(p.key);
                      }}
                    >
                      {p.label}
                      <Show when={p.sub}>
                        <small>{p.sub}</small>
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              <div
                class={`ruler${drag() ? " is-drag" : ""}${glide() ? " is-glide" : ""}`}
                tabIndex={0}
                role="slider"
                aria-label="启封距离：左右拖动或用方向键调整"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(v() * 100)}
                aria-valuetext={`${fmt.span(span())}后，${fmt.full(d.openAt)}`}
                onPointerDown={onRulerDown}
                onKeyDown={onRulerKey}
              >
                <div class="ruler__strip" style={{ transform: `translateX(${(-v() * STRIP_W).toFixed(1)}px)` }}>
                  <For each={TICKS}>
                    {(t) => (
                      <i class={t.cls} style={{ left: `${t.left}px` }}>
                        <Show when={t.label}>
                          <b>{t.label}</b>
                        </Show>
                      </i>
                    )}
                  </For>
                </div>
                <div class="ruler__needle" ref={needle} />
              </div>

              <div class="when">
                <div class="when__rel serif">{fmt.span(span())}后</div>
                <div class="when__abs" data-testid="create-openat" data-value={new Date(d.openAt).toISOString()}>
                  {fmt.full(d.openAt)}
                </div>
                <button class={`linkbtn when__more${calOpen() ? " is-open" : ""}`} type="button" aria-expanded={calOpen()} onClick={() => setCalOpen((o) => !o)}>
                  <Icon name="calendar" />
                  <span>精确到分钟</span>
                  <Icon name="chev-down" class="ic--chev" />
                </button>
              </div>
              <div class="sheet__err" role="alert" data-testid={f.errors.openAt ? "field-error" : undefined} data-field="openAt">
                {f.errors.openAt}
              </div>

              <div class={`calwrap${calOpen() ? " is-open" : ""}`}>
                <div class="calwrap__in">
                  <Show when={calOpen()}>
                    <Calendar
                      openAt={d.openAt}
                      onPick={(t) => {
                        setDragV(null);
                        setGlide(true);
                        f.setOpenAt(clampOpen(t));
                      }}
                    />
                  </Show>
                </div>
              </div>
            </section>

            <section class="panel">
              <h2 class="panel__h">
                <span class="panel__no">贰</span>寄往广场
              </h2>
              <label class="switch">
                <input type="checkbox" checked={d.inPlaza} data-testid="create-in-plaza" onChange={(e) => f.setInPlaza(e.currentTarget.checked)} />
                <span class="switch__track">
                  <i />
                </span>
                <span class="switch__text">
                  <b>{d.inPlaza ? "发布到胶囊广场" : "只凭胶囊码可见"}</b>
                  <small>{d.inPlaza ? "所有人能看到标题与倒计时；正文在启封后公开。" : "不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。"}</small>
                </span>
              </label>
            </section>

            <section class="panel panel--seal">
              <h2 class="panel__h">
                <span class="panel__no">叁</span>封缄
              </h2>
              <div class={`envf${d.inPlaza ? "" : " is-private"}`} aria-hidden="true">
                <div class="envf__stamp">
                  <AvatarStamp id={me().avatarId} class="stamp--sm" label={false} />
                </div>
                <div class="envf__pm">
                  <Postmark line1={fmt.date(d.openAt)} line2={`${fmt.time(d.openAt)} 启`} class="pm--envf" />
                </div>
                <div class="envf__to">
                  <small>寄往</small>
                  <b>{fmt.cn(d.openAt)}</b>
                  <span>{fmt.span(span())}后的未来</span>
                </div>
                <div class="envf__title serif">{d.title.trim() ? `《${d.title.trim()}》` : "《未命名的信》"}</div>
                <div class="envf__from mono">
                  <span>
                    自 {fmt.date(now())} · {me().nickname}
                  </span>
                  <span>{d.inPlaza ? "广场公开" : "仅凭码可见"}</span>
                </div>
              </div>

              <div class="hold-row">
                <button
                  ref={hold}
                  class={`hold${holdState() === "holding" ? " is-holding" : ""}${holdState() === "done" ? " is-done" : ""}${holdShake()}`}
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
                  <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
                    <circle class="hold__track" cx="60" cy="60" r="56" />
                    <circle class="hold__prog" cx="60" cy="60" r="56" pathLength={100} />
                  </svg>
                  <Wax ch="封" class="hold__wax" />
                  <span class="sr-only">长按封缄</span>
                </button>
                <div class="hold-copy">
                  <b id="holdHint">{f.submitting() ? "正在封缄…" : hint()}</b>
                  <p>
                    封缄后不可修改、不可提前开启；
                    <br />
                    可以在「我创建的」里删除。
                  </p>
                  <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
      <Show when={f.created()}>
        {(c) => (
          <Ceremony
            c={c()}
            onAgain={() => {
              f.again();
              setHoldState("");
              setHint("长按火漆，封缄");
              setHp("0");
              titleEl?.focus({ preventScroll: true });
            }}
          />
        )}
      </Show>
    </div>
  );
}
