// ============================================================
// 「时笺」视觉小件：印章、火漆、信封、邮戳、刻度尺、短倒计时、翻页数字、邮票
// 结构与类名照 2.0 原型 paper/ui.js；样式在 spec/styles/paper
// ============================================================

import { For, Index, Show, createEffect, createSignal, createUniqueId, on, onCleanup, type JSX } from "solid-js";
import { fmt, pad2 } from "@/lib/fmt";
import { avatarOf } from "@/lib/avatars";

/** 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） */
export function Seal(props: { ch: string; variant?: "solid" | "line"; class?: string }) {
  return (
    <span class={`seal seal--${props.variant ?? "solid"}${props.class ? " " + props.class : ""}`} aria-hidden="true">
      {props.ch}
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

export function Wax(props: { ch?: string; class?: string }) {
  const g = `wax-${createUniqueId()}`;
  const ch = () => props.ch ?? "封";
  return (
    <span class={props.class ? `wax ${props.class}` : "wax"} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id={g} cx="36%" cy="30%" r="78%">
            <stop offset="0" style={{ "stop-color": "var(--wax-hi)" }} />
            <stop offset=".5" style={{ "stop-color": "var(--wax)" }} />
            <stop offset="1" style={{ "stop-color": "var(--wax-lo)" }} />
          </radialGradient>
        </defs>
        <path d={WAX_OUT} fill="var(--wax-lo)" />
        <path d={WAX_IN} fill={`url(#${g})`} />
        <circle cx="50" cy="50" r="30.5" fill="none" stroke="var(--wax-lo)" stroke-width="2.4" opacity=".5" />
        <circle cx="50.7" cy="50.8" r="30.5" fill="none" stroke="var(--wax-hi)" stroke-width=".9" opacity=".55" />
        <text class="wax__ch wax__ch--hi" x="50.9" y="51.1" text-anchor="middle" dy=".36em">
          {ch()}
        </text>
        <text class="wax__ch" x="50" y="50" text-anchor="middle" dy=".36em">
          {ch()}
        </text>
        <ellipse cx="35" cy="29" rx="15" ry="7.5" fill="#fff" opacity=".17" transform="rotate(-30 35 29)" />
      </svg>
    </span>
  );
}

export type Crack = "whole" | "split" | "cracked";

/**
 * 信封（封口面）：back 内衬 → letter 信纸 → front 口袋 → flap 封舌 → seal 火漆
 * crack：火漆的状态。split 先换成左右两半，cracked 再让两半裂开（分两步，过渡才会生效）
 */
export function Envelope(props: { class?: string; letter?: JSX.Element; seal?: boolean; crack?: Crack }) {
  const crack = () => props.crack ?? "whole";
  return (
    <div class={props.class ? `env ${props.class}` : "env"}>
      <div class="env__back" />
      <div class="env__letter">{props.letter}</div>
      <div class="env__front">
        <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
          <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z" />
          <path class="env__shade" d="M1 2.2 50 38 99 2.2" />
          <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9" />
          <path class="env__edge" d="M0 0 50 36 100 0" />
        </svg>
      </div>
      <div class="env__flap">
        <i class="env__flap-f">
          <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 0 50 36 100 0" />
          </svg>
        </i>
        <i class="env__flap-b" />
      </div>
      <Show when={props.seal ?? true}>
        <div class={`env__seal${crack() === "cracked" ? " is-cracked" : ""}`}>
          <Show
            when={crack() === "whole"}
            fallback={
              <>
                <span class="wax-half wax-half--l">
                  <Wax />
                </span>
                <span class="wax-half wax-half--r">
                  <Wax />
                </span>
              </>
            }
          >
            <Wax />
          </Show>
        </div>
      </Show>
    </div>
  );
}

/** 信封里那张信纸：标题 + 四道横线（详情页与封缄仪式共用） */
export function LetterSlip(props: { title: string }) {
  return (
    <>
      <b>{props.title}</b>
      <i />
      <i />
      <i />
      <i />
    </>
  );
}

/** 邮戳：外圈两行弧形字，中间两行日期 */
export function Postmark(props: { line1?: string; line2?: string; top?: string; bottom?: string; class?: string }) {
  const id = `pm${createUniqueId()}`;
  return (
    <svg class={props.class ? `pm ${props.class}` : "pm"} viewBox="0 0 172 120" aria-hidden="true">
      <defs>
        <path id={`${id}a`} d="M16.5,60 a43.5,43.5 0 1,1 87,0" />
        <path id={`${id}b`} d="M9.5,60 a50.5,50.5 0 0,0 101,0" />
      </defs>
      <g class="pm__ring">
        <circle cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="37" />
      </g>
      <text class="pm__arc">
        <textPath href={`#${id}a`} startOffset="50%" text-anchor="middle">
          {props.top ?? "HELLOTIME · POST"}
        </textPath>
      </text>
      <text class="pm__arc pm__arc--cn">
        <textPath href={`#${id}b`} startOffset="50%" text-anchor="middle">
          {props.bottom ?? "时 光 邮 局"}
        </textPath>
      </text>
      <text class="pm__l1" x="60" y="59" text-anchor="middle">
        {props.line1 ?? ""}
      </text>
      <text class="pm__l2" x="60" y="74" text-anchor="middle">
        {props.line2 ?? ""}
      </text>
      <g class="pm__waves">
        <For each={[34, 47, 60, 73, 86]}>{(y) => <path d={`M120 ${y}q6.5-5 13 0t13 0 13 0 13 0`} />}</For>
      </g>
    </svg>
  );
}

/** 刻度尺：封存 → 启封 的等待进度 */
export function Scale(props: { p: number; class?: string }) {
  return (
    <div class={props.class ? `scale ${props.class}` : "scale"} style={{ "--p": `${props.p}%` }}>
      <i class="scale__fill" />
      <i class="scale__mark" />
    </div>
  );
}

/** 卡片上的短倒计时：超过一天显示「N 天 hh:mm:ss」 */
export function CdShort(props: { openAt: number; now: number }) {
  const c = () => fmt.cd(props.openAt, props.now);
  const hms = () => `${pad2(c().h)}:${pad2(c().m)}:${pad2(c().s)}`;
  return (
    <Show when={c().d > 0} fallback={<b class="mono cap__cd-hms">{hms()}</b>}>
      <b class="latin">{fmt.num(c().d)}</b>
      <small>天</small>
      <span class="mono">{hms()}</span>
    </Show>
  );
}

/**
 * 翻页数字的一位：变化时旧数字向上退出、新数字从下方进入。
 * keyed 的 <Show>：值一变就重建那个 <span>，CSS 入场动画随之重播（相当于 React 的 key）
 */
function Dg(props: { v: string }) {
  const [prev, setPrev] = createSignal<string | null>(null);
  createEffect(
    on(
      () => props.v,
      (_, last) => {
        if (last === undefined) return;
        setPrev(last);
        const t = setTimeout(() => setPrev(null), 520);
        onCleanup(() => clearTimeout(t));
      },
    ),
  );
  return (
    <span class="dg" data-v={props.v}>
      <Show when={prev()} keyed>
        {(p) => <span class="dg__out">{p}</span>}
      </Show>
      <Show when={props.v} keyed>
        {(v) => <span class="dg__cur" classList={{ dg__in: prev() !== null }}>{v}</span>}
      </Show>
    </span>
  );
}

/** 逐位翻动的数字：只有变了的那一位会动 */
export function FlipDigits(props: { value: string }) {
  return <Index each={Array.from(props.value)}>{(ch) => <Dg v={ch()} />}</Index>;
}

/** 邮票：头像徽记 + 齿孔边（label=false 时不写名字） */
export function AvatarStamp(props: { id: string; class?: string; label?: boolean }) {
  const a = () => avatarOf(props.id);
  return (
    <span class={props.class ? `stamp ${props.class}` : "stamp"} style={{ "--av": a().color }}>
      <span class="stamp__in">
        <svg viewBox="0 0 24 24" aria-hidden="true" innerHTML={a().glyph} />
        <Show when={props.label ?? true}>
          <b>{a().name}</b>
        </Show>
      </span>
    </span>
  );
}
