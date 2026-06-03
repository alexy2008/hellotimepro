import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { CapsuleDetail as CapsuleDetailT } from "@/types";
import { avatarUrl } from "@/utils/avatar";
import { countdownTo, fmtDateTime } from "@/utils/format";
import { FavoriteButton } from "./FavoriteButton";

function CalendarUnit(props: { value: number; label: string }) {
  const str = () => String(props.value).padStart(2, "0");
  const isLong = () => str().length > 2;
  let latestStr = str();
  const [shown, setShown] = createSignal(str());
  const [phase, setPhase] = createSignal<"idle" | "fold" | "unfold">("idle");

  createEffect(() => {
    const s = str();
    if (s === latestStr) return;
    latestStr = s;
    setPhase("fold");
  });

  function handleAnimationEnd() {
    if (phase() === "fold") {
      setShown(latestStr);
      setPhase("unfold");
    } else if (phase() === "unfold") {
      setPhase("idle");
    }
  }

  return (
    <div class={`cy-cal-unit${isLong() ? " cy-cal-unit--wide" : ""}`}>
      <div
        class={`cy-cal-card${isLong() ? " cy-cal-card--wide" : ""}${
          phase() !== "idle" ? ` cy-cal-card--${phase()}` : ""
        }`}
        onAnimationEnd={handleAnimationEnd}
      >
        <div class="cy-cal-num">{shown()}</div>
        <div class="cy-cal-crease" />
      </div>
      <div class="cy-cal-label">{props.label}</div>
    </div>
  );
}

export function CapsuleDetail(props: {
  capsule: CapsuleDetailT;
  onChange?: (c: CapsuleDetailT) => void;
  onExpired?: () => Promise<CapsuleDetailT | null | void>;
}) {
  const opened = () => props.capsule.isOpened;

  const [now, setNow] = createSignal(Date.now());
  const [autoOpening, setAutoOpening] = createSignal(false);

  // 倒计时 tick
  createEffect(() => {
    if (opened()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(t));
  });

  // 到点后自动刷新开启状态
  createEffect(() => {
    if (opened() || !props.onExpired) return;

    const openAt = new Date(props.capsule.openAt).getTime();
    if (Number.isNaN(openAt)) return;

    let alive = true;
    let timer: number | undefined;

    async function refreshAfterExpiry() {
      if (!alive) return;
      setAutoOpening(true);
      try {
        const refreshed = await props.onExpired?.();
        if (alive && !(refreshed && refreshed.isOpened)) {
          timer = window.setTimeout(refreshAfterExpiry, 1000);
        }
      } finally {
        if (alive) setAutoOpening(false);
      }
    }

    timer = window.setTimeout(refreshAfterExpiry, Math.max(0, openAt - Date.now() + 250));

    onCleanup(() => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    });
  });

  const cd = () => countdownTo(props.capsule.openAt, now());
  const [codeCopied, setCodeCopied] = createSignal(false);
  const [linkCopied, setLinkCopied] = createSignal(false);

  function copyCode() {
    void navigator.clipboard.writeText(props.capsule.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }
  function copyLink() {
    void navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div class="cy-capsule-detail">
      <div class="cy-capsule-detail__head">
        <span
          class={`cy-badge ${opened() ? "cy-badge--opened" : "cy-badge--sealed"}`}
        >
          {opened() ? "已开启" : "未开启"}
        </span>
        <Show when={props.capsule.inPlaza}>
          <span class="cy-badge cy-badge--plaza">广场公开</span>
        </Show>
        <span class="cy-capsule__code">{props.capsule.code}</span>
        <span
          style={{
            color: "var(--color-text-muted)",
            "font-size": "var(--font-size-sm)",
          }}
        >
          · 创建于 {fmtDateTime(props.capsule.createdAt)}
        </span>
      </div>

      <h1 class="cy-capsule-detail__title">{props.capsule.title}</h1>

      <Show
        when={opened() && props.capsule.content !== null}
        fallback={
          <div class="cy-capsule-detail__sealed">
            <div style={{ "font-size": "var(--font-size-4xl)", opacity: "0.7" }}>
              🔒
            </div>
            <div
              style={{
                color: "var(--color-text-secondary)",
                "margin-top": "var(--space-3)",
                "font-size": "var(--font-size-sm)",
                "letter-spacing": "0.1em",
              }}
            >
              这封信还在上锁，将在以下时刻开启
            </div>
            <div class="cy-cal">
              <CalendarUnit value={cd().days} label="天" />
              <span class="cy-cal-sep">:</span>
              <CalendarUnit value={cd().hours} label="时" />
              <span class="cy-cal-sep">:</span>
              <CalendarUnit value={cd().minutes} label="分" />
              <span class="cy-cal-sep">:</span>
              <CalendarUnit value={cd().seconds} label="秒" />
            </div>
            <div style={{ color: "var(--color-text-secondary)" }}>
              <Show
                when={cd().expired}
                fallback={
                  <>
                    开启于{" "}
                    <strong style={{ color: "var(--color-text-primary)" }}>
                      {fmtDateTime(props.capsule.openAt)}
                    </strong>
                  </>
                }
              >
                {autoOpening() ? "正在开启…" : "正在同步开启状态…"}
              </Show>
            </div>
          </div>
        }
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "var(--space-2)",
            "margin-bottom": "var(--space-4)",
            "font-size": "var(--font-size-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          <span>🔓</span>
          <span>
            开启于{" "}
            <strong style={{ color: "var(--color-capsule-opened-accent)" }}>
              {fmtDateTime(props.capsule.openAt)}
            </strong>
          </span>
        </div>
        <div class="cy-capsule-detail__content">{props.capsule.content}</div>
      </Show>

      <div
        style={{
          "margin-top": "var(--space-6)",
          display: "flex",
          "justify-content": "space-between",
          "align-items": "center",
          "flex-wrap": "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "var(--space-2)",
            color: "var(--color-text-secondary)",
            "font-size": "var(--font-size-sm)",
          }}
        >
          来自
          <img
            src={avatarUrl(props.capsule.creator.avatarId)}
            alt=""
            style={{ width: "32px", height: "32px", "border-radius": "50%" }}
          />
          <strong style={{ color: "var(--color-text-primary)" }}>
            {props.capsule.creator.nickname}
          </strong>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" class="cy-btn cy-btn--ghost" onClick={copyCode}>
            {codeCopied() ? "✓ 已复制!" : "📎 复制 8 位码"}
          </button>
          <button type="button" class="cy-btn cy-btn--ghost" onClick={copyLink}>
            {linkCopied() ? "✓ 已复制!" : "🔗 分享链接"}
          </button>
          <FavoriteButton
            capsule={props.capsule}
            size="md"
            onChange={(fav, count) =>
              props.onChange?.({
                ...props.capsule,
                favoritedByMe: fav,
                favoriteCount: count,
              })
            }
          />
        </div>
      </div>

      <Show when={!opened()}>
        <div class="cy-alert cy-alert--info" style={{ "margin-top": "var(--space-6)" }}>
          <span>ⓘ</span>
          <span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
        </div>
      </Show>
      <Show when={opened() && props.capsule.inPlaza}>
        <div class="cy-alert cy-alert--success" style={{ "margin-top": "var(--space-6)" }}>
          <span>✓</span>
          <span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
        </div>
      </Show>
    </div>
  );
}
