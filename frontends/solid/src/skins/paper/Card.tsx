// ============================================================
// 「时笺」胶囊卡片：同一只信封的两种状态
// 未开启 —— 合着、舌尖钤朱印，正文被模糊遮住，下面是等待进度的刻度尺
// 已开启 —— 封舌掀起、信纸露出半截，两行正文预览
// ============================================================

import { Show } from "solid-js";
import type { CapsuleListItem } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { Icon } from "@/lib/icons";
import { Avatar } from "@/components/shared";
import { FavButton } from "@/components/FavButton";
import { CdShort, Scale, Seal } from "./parts";

const EnvSealed = () => (
  <svg class="cap__art" viewBox="0 0 120 84" aria-hidden="true">
    <rect class="ea__body" x="2" y="6" width="116" height="76" rx="3" />
    <path class="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46" />
    <path class="ea__flap" d="M3 7.5 60 48 117 7.5" />
    <g class="ea__seal">
      <circle cx="60" cy="48" r="11" />
      <circle class="ea__seal-ring" cx="60" cy="48" r="7" />
    </g>
  </svg>
);
const EnvOpened = () => (
  <svg class="cap__art" viewBox="0 0 120 100" aria-hidden="true">
    <path class="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <rect class="ea__paper" x="16" y="14" width="88" height="62" rx="1.5" />
    <path class="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44" />
    <path class="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <path class="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70" />
  </svg>
);

export const preview = (text: string | null | undefined, n = 78) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "……" : t;
};

export interface CardProps {
  c: CapsuleListItem;
  i?: number;
  rank?: number;
  mine?: boolean;
  now: number;
  /** 「我收藏的」里用 fav-item / row-open（spec/ui/testids.md §3.7） */
  testId?: string;
  openTestId?: string;
  onFavChange?: (favorited: boolean, count: number) => void;
}

export function PaperCard(props: CardProps) {
  const openAt = () => ms(props.c.openAt);
  const createdAt = () => ms(props.c.createdAt);
  const opened = () => props.c.isOpened || openAt() <= props.now;
  return (
    <article
      class={`cap cap--${opened() ? "opened" : "sealed"}`}
      style={{ "--i": props.i ?? 0 }}
      data-testid={props.testId ?? "capsule-card"}
      data-code={props.c.code}
      data-state={opened() ? "opened" : "sealed"}
      data-in-plaza={String(props.c.inPlaza)}
    >
      <div class="cap__bg" aria-hidden="true">
        <Show when={opened()} fallback={<EnvSealed />}>
          <EnvOpened />
        </Show>
      </div>
      <a
        class="cap__link"
        href={`/capsules/${props.c.code}`}
        aria-label={`${props.c.title}，${opened() ? "已开启" : "未开启"}`}
        data-testid={props.openTestId ?? "card-open"}
      />
      <header class="cap__top">
        <Seal ch={opened() ? "启" : "封"} variant={opened() ? "line" : "solid"} />
        <span class="cap__status">{opened() ? "已开启" : "未开启"}</span>
        <Show when={!props.c.inPlaza}>
          <span class="cap__private" title="没有发布到广场，凭胶囊码可见">
            <Icon name="lock" />
            未公开
          </span>
        </Show>
        <Show when={props.rank}>
          <span class="cap__rank latin" title={`热度第 ${props.rank}`}>
            No.{props.rank}
          </span>
        </Show>
        <span class="cap__code mono">{props.c.code}</span>
      </header>
      <h3 class="cap__title" data-testid="card-title">
        {props.c.title}
      </h3>
      <Show
        when={opened()}
        fallback={
          <>
            <div class="cap__veil" aria-hidden="true">
              <i />
              <i />
            </div>
            <div class="cap__cd">
              <span class="cap__cd-label">距启封</span>
              <span class="cap__cd-val">
                <CdShort openAt={openAt()} now={props.now} />
              </span>
            </div>
            <Scale p={fmt.progress(createdAt(), openAt(), props.now)} />
            <div class="cap__ends mono">
              <span>{fmt.date(createdAt())}</span>
              <span>{fmt.date(openAt())}</span>
            </div>
          </>
        }
      >
        <p class="cap__preview">{preview(props.c.contentPreview)}</p>
        <div class="cap__when">
          <span>启于 {fmt.date(openAt())}</span>
          <i />
          <span>在途 {fmt.span(openAt() - createdAt())}</span>
        </div>
      </Show>
      <footer class="cap__foot">
        <span class="who">
          <Avatar id={props.c.creator.avatarId} />
          <span class="who__n">{props.c.creator.nickname}</span>
          <Show when={props.mine}>
            <em class="who__me">我</em>
          </Show>
        </span>
        <FavButton capsule={props.c} onChange={props.onFavChange} />
      </footer>
    </article>
  );
}

export function PaperCardSkeleton(props: { i: number }) {
  return (
    <div class="cap cap--skel" style={{ "--i": props.i }} aria-hidden="true">
      <i class="sk sk--a" />
      <i class="sk sk--b" />
      <i class="sk sk--c" />
      <i class="sk sk--c2" />
      <i class="sk sk--d" />
    </div>
  );
}
