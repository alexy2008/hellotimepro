// ============================================================
// 「琥珀」视觉小件：胶囊插画、徽标、短倒计时、邮戳、翻牌倒计时
// 结构与类名照 2.0 原型 amber/ui.js；样式在 spec/styles/amber
// ============================================================

import { Index, Show, createUniqueId, type JSX } from "solid-js";
import { fmt, pad2 } from "@/lib/fmt";
import { Icon, type IconName } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";

/**
 * 胶囊插画：全站反复出现的母题。左半是专属配色的舱盖，右半是能看见信纸的玻璃舱。
 * locked 合拢上锁；opened 两半分开、信纸升起。切换形态只改 class，过渡由 CSS 完成。
 */
export function CapsuleArt(props: { code: string | null; state?: "locked" | "opened"; width?: number; class?: string }) {
  const p = () => paletteOf(props.code);
  const id = `ca${createUniqueId()}`;
  const w = () => props.width ?? 200;
  return (
    <svg
      class={`cart cart--${props.state ?? "locked"}${props.class ? " " + props.class : ""}`}
      width={w()}
      height={w() / 2}
      viewBox="0 0 240 120"
      style={{ "--cap-glow": p().glow }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={p().capLight} />
          <stop offset="1" stop-color={p().capDeep} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".62" />
          <stop offset="1" stop-color={p().accent} stop-opacity=".42" />
        </linearGradient>
      </defs>
      <ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6" />
      <g class="cart__paper">
        <rect x="98" y="24" width="44" height="62" rx="5" />
        <path d="M106 40h28M106 50h28M106 60h17" />
      </g>
      <g class="cart__cap">
        <path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill={`url(#${id}c)`} />
        <path class="cart__groove" d="M104 31v58M111 31v58" />
        <path class="cart__shine" d="M60 41h36" />
      </g>
      <g class="cart__body">
        <path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill={`url(#${id}g)`} />
        <rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6" />
        <path class="cart__scroll-line" d="M141 56h30M141 64h19" />
        <path class="cart__shine" d="M132 40h40" />
      </g>
      <rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5" />
      <circle class="cart__lock" cx="120" cy="60" r="4.5" />
    </svg>
  );
}

export function Badge(props: { kind: string; icon?: IconName; children: JSX.Element }) {
  return (
    <span class={`badge badge--${props.kind}`}>
      <Show when={props.icon}>{(ic) => <Icon name={ic()} />}</Show>
      {props.children}
    </span>
  );
}

/** 「广场公开 / 仅凭码可见」徽标：详情、我创建的、回执与预览都用 */
export function VisBadge(props: { inPlaza: boolean }) {
  return (
    <Show when={props.inPlaza} fallback={<Badge kind="private" icon="lock">仅凭码可见</Badge>}>
      <Badge kind="plaza" icon="globe">
        广场公开
      </Badge>
    </Show>
  );
}

/** 紧凑倒计时（卡片用）：00:59:12 或 3,508 天 23:54:25 */
export function cdShort(openAt: number, now: number) {
  const c = fmt.cd(openAt, now);
  const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
  return c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
}

/** 邮戳：外圈文字沿圆排布，略微歪斜，像用手盖上去的 */
export function Stamp(props: { date: number; label?: string; class?: string }) {
  const id = `st${createUniqueId()}`;
  return (
    <svg class={props.class ? `stamp ${props.class}` : "stamp"} viewBox="0 0 140 140" aria-hidden="true">
      <defs>
        <path id={id} d="M18 70a52 52 0 1 1 104 0a52 52 0 1 1-104 0" />
      </defs>
      <circle class="stamp__ring" cx="70" cy="70" r="66" />
      <circle class="stamp__ring stamp__ring--in" cx="70" cy="70" r="40" />
      <text class="stamp__arc">
        <textPath href={`#${id}`} textLength="316" lengthAdjust="spacing">
          HELLOTIME PRO · 时间胶囊 · TIME CAPSULE ·
        </textPath>
      </text>
      <text class="stamp__label" x="70" y="68" text-anchor="middle">
        {props.label ?? "已开启"}
      </text>
      <text class="stamp__date" x="70" y="86" text-anchor="middle">
        {fmt.date(props.date)}
      </text>
    </svg>
  );
}

/**
 * 翻牌倒计时：天 / 时 / 分 / 秒。每一位用 keyed 的 <Show> 包住，
 * 某一位的数字变了就重建那个格子，从而重播「落下」的动画（相当于 React 里以「位置 + 数字」作 key）
 */
export function Countdown(props: { openAt: number; now: number }) {
  const c = () => fmt.cd(props.openAt, props.now);
  const units = () =>
    [
      ["d", "天", String(c().d).padStart(2, "0")],
      ["h", "时", pad2(c().h)],
      ["m", "分", pad2(c().m)],
      ["s", "秒", pad2(c().s)],
    ] as const;
  return (
    <div class="cd" role="timer" aria-label={`距离开启还有 ${c().d} 天 ${c().h} 小时 ${c().m} 分 ${c().s} 秒`}>
      <Index each={units()}>
        {(u, i) => (
          <>
            <Show when={i}>
              <div class="cd__sep" aria-hidden="true">
                :
              </div>
            </Show>
            <div class={`cd__unit${u()[0] === "s" ? " cd__unit--accent" : ""}`}>
              <div class="cd__digits">
                <Index each={Array.from(u()[2])}>
                  {(d) => (
                    <Show when={d()} keyed>
                      {(v) => <span class="cd__digit">{v}</span>}
                    </Show>
                  )}
                </Index>
              </div>
              <div class="cd__label">{u()[1]}</div>
            </div>
          </>
        )}
      </Index>
    </div>
  );
}

/** 四角星芒（首页主视觉） */
export function sparkle(cx: number, cy: number, r: number) {
  const k = r * 0.14;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/** 一串 8 位码牌：回执里用（与原型同一结构） */
export function Tiles(props: { code: string }) {
  return (
    <Index each={Array.from(props.code)}>
      {(ch, i) => (
        <span class={`tile${i === 4 ? " has-gap" : ""}`} style={{ "--i": i }}>
          {ch()}
        </span>
      )}
    </Index>
  );
}
