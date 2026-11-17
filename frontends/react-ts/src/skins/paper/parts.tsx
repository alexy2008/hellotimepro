// ============================================================
// 「时笺」视觉小件：印章、火漆、信封、邮戳、刻度尺、短倒计时
// 结构与类名照 2.0 原型 paper/ui.js；样式在 spec/styles/paper
// ============================================================

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { fmt, pad2 } from "@/lib/fmt";
import { avatarOf } from "@/lib/avatars";

/** 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） */
export function Seal({ ch, variant = "solid", className }: { ch: string; variant?: "solid" | "line"; className?: string }) {
  return (
    <span className={`seal seal--${variant}${className ? " " + className : ""}`} aria-hidden="true">
      {ch}
    </span>
  );
}

/* 火漆：不规则的蜡滴轮廓由种子随机生成，保证每次形状一致 */
function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function blobPath(cx: number, cy: number, r: number, n: number, jitter: number, seed: number) {
  const rnd = mulberry(seed);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rnd() - 0.5) * 2 * jitter);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + "Z";
}
const WAX_OUT = blobPath(50, 50, 46, 18, 0.055, 21);
const WAX_IN = blobPath(50, 50, 43.5, 14, 0.03, 8);

export function Wax({ ch = "封", className }: { ch?: string; className?: string }) {
  const g = `wax-${useId().replace(/:/g, "")}`;
  return (
    <span className={className ? `wax ${className}` : "wax"} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id={g} cx="36%" cy="30%" r="78%">
            <stop offset="0" style={{ stopColor: "var(--wax-hi)" }} />
            <stop offset=".5" style={{ stopColor: "var(--wax)" }} />
            <stop offset="1" style={{ stopColor: "var(--wax-lo)" }} />
          </radialGradient>
        </defs>
        <path d={WAX_OUT} fill="var(--wax-lo)" />
        <path d={WAX_IN} fill={`url(#${g})`} />
        <circle cx="50" cy="50" r="30.5" fill="none" stroke="var(--wax-lo)" strokeWidth="2.4" opacity=".5" />
        <circle cx="50.7" cy="50.8" r="30.5" fill="none" stroke="var(--wax-hi)" strokeWidth=".9" opacity=".55" />
        <text className="wax__ch wax__ch--hi" x="50.9" y="51.1" textAnchor="middle" dy=".36em">
          {ch}
        </text>
        <text className="wax__ch" x="50" y="50" textAnchor="middle" dy=".36em">
          {ch}
        </text>
        <ellipse cx="35" cy="29" rx="15" ry="7.5" fill="#fff" opacity=".17" transform="rotate(-30 35 29)" />
      </svg>
    </span>
  );
}

/**
 * 信封（封口面）：back 内衬 → letter 信纸 → front 口袋 → flap 封舌 → seal 火漆
 * crack：火漆的状态。split 先换成左右两半，cracked 再让两半裂开（分两步，过渡才会生效）
 */
export function Envelope({ className, letter, seal = true, crack = "whole" }: {
  className?: string; letter?: React.ReactNode; seal?: boolean; crack?: "whole" | "split" | "cracked";
}) {
  return (
    <div className={className ? `env ${className}` : "env"}>
      <div className="env__back" />
      <div className="env__letter">{letter}</div>
      <div className="env__front">
        <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
          <path className="env__pocket" d="M0 0 50 36 100 0V64H0Z" />
          <path className="env__shade" d="M1 2.2 50 38 99 2.2" />
          <path className="env__seam" d="M0 64 47 33.9M100 64 53 33.9" />
          <path className="env__edge" d="M0 0 50 36 100 0" />
        </svg>
      </div>
      <div className="env__flap">
        <i className="env__flap-f">
          <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 0 50 36 100 0" />
          </svg>
        </i>
        <i className="env__flap-b" />
      </div>
      {seal ? (
        <div className={`env__seal${crack === "cracked" ? " is-cracked" : ""}`}>
          {crack === "whole" ? (
            <Wax />
          ) : (
            <>
              <span className="wax-half wax-half--l">
                <Wax />
              </span>
              <span className="wax-half wax-half--r">
                <Wax />
              </span>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 邮戳：外圈两行弧形字，中间两行日期 */
export function Postmark({ line1 = "", line2 = "", top = "HELLOTIME · POST", bottom = "时 光 邮 局", className }: {
  line1?: string; line2?: string; top?: string; bottom?: string; className?: string;
}) {
  const id = `pm${useId().replace(/:/g, "")}`;
  return (
    <svg className={className ? `pm ${className}` : "pm"} viewBox="0 0 172 120" aria-hidden="true">
      <defs>
        <path id={`${id}a`} d="M16.5,60 a43.5,43.5 0 1,1 87,0" />
        <path id={`${id}b`} d="M9.5,60 a50.5,50.5 0 0,0 101,0" />
      </defs>
      <g className="pm__ring">
        <circle cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="37" />
      </g>
      <text className="pm__arc">
        <textPath href={`#${id}a`} startOffset="50%" textAnchor="middle">{top}</textPath>
      </text>
      <text className="pm__arc pm__arc--cn">
        <textPath href={`#${id}b`} startOffset="50%" textAnchor="middle">{bottom}</textPath>
      </text>
      <text className="pm__l1" x="60" y="59" textAnchor="middle">{line1}</text>
      <text className="pm__l2" x="60" y="74" textAnchor="middle">{line2}</text>
      <g className="pm__waves">
        {[34, 47, 60, 73, 86].map((y) => (
          <path key={y} d={`M120 ${y}q6.5-5 13 0t13 0 13 0 13 0`} />
        ))}
      </g>
    </svg>
  );
}

/** 刻度尺：封存 → 启封 的等待进度 */
export function Scale({ p, className }: { p: number; className?: string }) {
  return (
    <div className={className ? `scale ${className}` : "scale"} style={{ "--p": `${p}%` } as CSSProperties}>
      <i className="scale__fill" />
      <i className="scale__mark" />
    </div>
  );
}

/** 卡片上的短倒计时：超过一天显示「N 天 hh:mm:ss」 */
export function CdShort({ openAt, now }: { openAt: number; now: number }) {
  const c = fmt.cd(openAt, now);
  const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
  return c.d > 0 ? (
    <>
      <b className="latin">{fmt.num(c.d)}</b>
      <small>天</small>
      <span className="mono">{hms}</span>
    </>
  ) : (
    <b className="mono cap__cd-hms">{hms}</b>
  );
}

/** 翻页数字的一位：变化时旧数字向上退出、新数字从下方进入 */
function Dg({ v }: { v: string }) {
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(v);
  useEffect(() => {
    if (last.current === v) return;
    setPrev(last.current);
    last.current = v;
    const t = setTimeout(() => setPrev(null), 520);
    return () => clearTimeout(t);
  }, [v]);
  return (
    <span className="dg" data-v={v}>
      {prev !== null ? (
        <span className="dg__out" key={`o${prev}`}>
          {prev}
        </span>
      ) : null}
      <span className={`dg__cur${prev !== null ? " dg__in" : ""}`} key={v}>
        {v}
      </span>
    </span>
  );
}

/** 逐位翻动的数字：只有变了的那一位会动 */
export function FlipDigits({ value }: { value: string }) {
  return (
    <>
      {Array.from(value).map((ch, i) => (
        <Dg key={i} v={ch} />
      ))}
    </>
  );
}

/** 邮票：头像徽记 + 齿孔边（label=false 时不写名字） */
export function AvatarStamp({ id, className, label = true }: { id: string; className?: string; label?: boolean }) {
  const a = avatarOf(id);
  return (
    <span className={className ? `stamp ${className}` : "stamp"} style={{ "--av": a.color } as CSSProperties}>
      <span className="stamp__in">
        <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: a.glyph }} />
        {label ? <b>{a.name}</b> : null}
      </span>
    </span>
  );
}
