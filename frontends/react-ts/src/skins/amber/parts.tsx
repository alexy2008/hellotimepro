// ============================================================
// 「琥珀」视觉小件：胶囊插画、徽标、短倒计时
// 结构与类名照 2.0 原型 amber/ui.js；样式在 spec/styles/amber
// ============================================================

import { useId, type CSSProperties } from "react";
import { fmt, pad2 } from "@/lib/fmt";
import { Icon, type IconName } from "@/lib/icons";
import { paletteOf } from "@/lib/palette";

/**
 * 胶囊插画：全站反复出现的母题。左半是专属配色的舱盖，右半是能看见信纸的玻璃舱。
 * locked 合拢上锁；opened 两半分开、信纸升起。切换形态只改 class，过渡由 CSS 完成。
 */
export function CapsuleArt({ code, state = "locked", width = 200, className }: {
  code: string | null; state?: "locked" | "opened"; width?: number; className?: string;
}) {
  const p = paletteOf(code);
  const id = `ca${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={`cart cart--${state}${className ? " " + className : ""}`}
      width={width}
      height={width / 2}
      viewBox="0 0 240 120"
      style={{ "--cap-glow": p.glow } as CSSProperties}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.capLight} />
          <stop offset="1" stopColor={p.capDeep} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".62" />
          <stop offset="1" stopColor={p.accent} stopOpacity=".42" />
        </linearGradient>
      </defs>
      <ellipse className="cart__shadow" cx="120" cy="107" rx="74" ry="6" />
      <g className="cart__paper">
        <rect x="98" y="24" width="44" height="62" rx="5" />
        <path d="M106 40h28M106 50h28M106 60h17" />
      </g>
      <g className="cart__cap">
        <path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill={`url(#${id}c)`} />
        <path className="cart__groove" d="M104 31v58M111 31v58" />
        <path className="cart__shine" d="M60 41h36" />
      </g>
      <g className="cart__body">
        <path className="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill={`url(#${id}g)`} />
        <rect className="cart__scroll" x="133" y="46" width="46" height="28" rx="6" />
        <path className="cart__scroll-line" d="M141 56h30M141 64h19" />
        <path className="cart__shine" d="M132 40h40" />
      </g>
      <rect className="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5" />
      <circle className="cart__lock" cx="120" cy="60" r="4.5" />
    </svg>
  );
}

export function Badge({ kind, icon, children }: { kind: string; icon?: IconName; children: React.ReactNode }) {
  return (
    <span className={`badge badge--${kind}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

/** 紧凑倒计时（卡片用）：00:59:12 或 3,508 天 23:54:25 */
export function cdShort(openAt: number, now: number) {
  const c = fmt.cd(openAt, now);
  const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
  return c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
}
