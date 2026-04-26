import { useEffect, useRef, useState } from "react";
import type { CapsuleDetail as CapsuleDetailT } from "@/types";
import { avatarUrl } from "@/utils/avatar";
import { countdownTo, fmtDateTime } from "@/utils/format";
import { FavoriteButton } from "./FavoriteButton";

function CalendarUnit({ value, label }: { value: number; label: string }) {
  const str = String(value).padStart(2, "0");
  const latestStr = useRef(str);
  const [shown, setShown] = useState(str);
  const [phase, setPhase] = useState<"idle" | "fold" | "unfold">("idle");

  useEffect(() => {
    if (str === latestStr.current) return;
    latestStr.current = str;
    setPhase("fold");
  }, [str]);

  function handleAnimationEnd() {
    if (phase === "fold") {
      setShown(latestStr.current);
      setPhase("unfold");
    } else if (phase === "unfold") {
      setPhase("idle");
    }
  }

  return (
    <div className="cy-cal-unit">
      <div
        className={`cy-cal-card${phase !== "idle" ? ` cy-cal-card--${phase}` : ""}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className={`cy-cal-num${shown.length > 2 ? " cy-cal-num--sm" : ""}`}>{shown}</div>
        <div className="cy-cal-crease" />
      </div>
      <div className="cy-cal-label">{label}</div>
    </div>
  );
}

export function CapsuleDetail({
  capsule,
  onChange,
  onExpired,
}: {
  capsule: CapsuleDetailT;
  onChange?: (c: CapsuleDetailT) => void;
  onExpired?: () => Promise<CapsuleDetailT | null | void>;
}) {
  const opened = capsule.isOpened;

  const [now, setNow] = useState(() => Date.now());
  const [autoOpening, setAutoOpening] = useState(false);

  useEffect(() => {
    if (opened) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [opened]);

  useEffect(() => {
    if (opened || !onExpired) return;

    const openAt = new Date(capsule.openAt).getTime();
    if (Number.isNaN(openAt)) return;

    let alive = true;
    let timer: number | undefined;

    async function refreshAfterExpiry() {
      if (!alive) return;
      setAutoOpening(true);
      try {
        const refreshed = await onExpired?.();
        if (alive && !refreshed?.isOpened) {
          timer = window.setTimeout(refreshAfterExpiry, 1000);
        }
      } finally {
        if (alive) setAutoOpening(false);
      }
    }

    timer = window.setTimeout(
      refreshAfterExpiry,
      Math.max(0, openAt - Date.now() + 250),
    );

    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [capsule.openAt, onExpired, opened]);

  const cd = countdownTo(capsule.openAt, now);

  function copyCode() {
    void navigator.clipboard.writeText(capsule.code);
  }
  function copyLink() {
    void navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div className="cy-capsule-detail">
      <div className="cy-capsule-detail__head">
        <span className={`cy-badge ${opened ? "cy-badge--opened" : "cy-badge--sealed"}`}>
          {opened ? "已开启" : "未开启"}
        </span>
        {capsule.inPlaza && <span className="cy-badge cy-badge--plaza">广场公开</span>}
        <span className="cy-capsule__code">{capsule.code}</span>
        <span style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          · 创建于 {fmtDateTime(capsule.createdAt)}
        </span>
      </div>

      <h1 className="cy-capsule-detail__title">{capsule.title}</h1>

      {opened && capsule.content !== null ? (
        <div className="cy-capsule-detail__content">{capsule.content}</div>
      ) : (
        <div className="cy-capsule-detail__sealed">
          <div style={{ fontSize: "var(--font-size-4xl)", opacity: 0.7 }}>🔒</div>
          <div
            style={{
              color: "var(--color-text-secondary)",
              marginTop: "var(--space-3)",
              fontSize: "var(--font-size-sm)",
              letterSpacing: "0.1em",
            }}
          >
            这封信还在上锁，将在以下时刻开启
          </div>
          <div className="cy-cal">
            <CalendarUnit value={cd.days} label="天" />
            <span className="cy-cal-sep">:</span>
            <CalendarUnit value={cd.hours} label="时" />
            <span className="cy-cal-sep">:</span>
            <CalendarUnit value={cd.minutes} label="分" />
            <span className="cy-cal-sep">:</span>
            <CalendarUnit value={cd.seconds} label="秒" />
          </div>
          <div style={{ color: "var(--color-text-secondary)" }}>
            {cd.expired ? (
              autoOpening ? (
                "正在开启…"
              ) : (
                "正在同步开启状态…"
              )
            ) : (
              <>
                开启于{" "}
                <strong style={{ color: "var(--color-text-primary)" }}>
                  {fmtDateTime(capsule.openAt)}
                </strong>
              </>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "var(--space-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          来自
          <img
            src={avatarUrl(capsule.creator.avatarId)}
            alt=""
            style={{ width: 32, height: 32, borderRadius: "50%" }}
          />
          <strong style={{ color: "var(--color-text-primary)" }}>{capsule.creator.nickname}</strong>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button type="button" className="cy-btn cy-btn--ghost" onClick={copyCode}>
            📎 复制 8 位码
          </button>
          <button type="button" className="cy-btn cy-btn--ghost" onClick={copyLink}>
            🔗 分享链接
          </button>
          <FavoriteButton
            capsule={capsule}
            size="md"
            onChange={(fav, count) =>
              onChange?.({ ...capsule, favoritedByMe: fav, favoriteCount: count })
            }
          />
        </div>
      </div>

      {!opened && (
        <div className="cy-alert cy-alert--info" style={{ marginTop: "var(--space-6)" }}>
          <span>ⓘ</span>
          <span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
        </div>
      )}
      {opened && capsule.inPlaza && (
        <div className="cy-alert cy-alert--success" style={{ marginTop: "var(--space-6)" }}>
          <span>✓</span>
          <span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
        </div>
      )}
    </div>
  );
}
