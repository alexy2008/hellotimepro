import { createEffect, createSignal, onCleanup, Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import type { CapsuleListItem } from "@/types";
import { avatarUrl } from "@/utils/avatar";
import { countdownTo, fmtNumber, pad2 } from "@/utils/format";
import { FavoriteButton } from "./FavoriteButton";

export function CapsuleCard(props: {
  capsule: CapsuleListItem;
  showCreator?: boolean;
  rightSlot?: JSX.Element; // me-created 列表里替换为撤回按钮
  hideFavorite?: boolean;
}) {
  const opened = () => props.capsule.isOpened;
  const showCreator = () => props.showCreator ?? true;

  // 倒计时（仅未开启卡片需要每秒刷新）
  const [now, setNow] = createSignal(Date.now());
  createEffect(() => {
    if (opened()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(t));
  });

  const cd = () => countdownTo(props.capsule.openAt, now());

  return (
    <article
      class={`cy-capsule ${opened() ? "cy-capsule--opened" : "cy-capsule--sealed"}`}
    >
      <div class="cy-capsule__head">
        <span
          class={`cy-badge ${opened() ? "cy-badge--opened" : "cy-badge--sealed"}`}
        >
          {opened() ? "已开启" : "未开启"}
        </span>
        <A
          href={`/c/${props.capsule.code}`}
          class="cy-capsule__code"
          style={{ "text-decoration": "none" }}
        >
          {props.capsule.code}
        </A>
      </div>

      <A
        href={`/c/${props.capsule.code}`}
        style={{ "text-decoration": "none", color: "inherit" }}
      >
        <h3 class="cy-capsule__title">{props.capsule.title}</h3>
      </A>

      <Show when={!opened()}>
        <p class="cy-capsule__countdown">
          ⏳ 还剩 {fmtNumber(cd().days)} 天 · {pad2(cd().hours)}:
          {pad2(cd().minutes)}:{pad2(cd().seconds)}
        </p>
      </Show>
      <Show when={opened() && props.capsule.contentPreview}>
        <p class="cy-capsule__preview">{props.capsule.contentPreview}</p>
      </Show>

      <div class="cy-capsule__meta">
        <Show
          when={showCreator()}
          fallback={
            <span style={{ color: "var(--color-text-muted)" }}>
              创建于 {new Date(props.capsule.createdAt).toLocaleDateString("zh-CN")}
            </span>
          }
        >
          <span class="cy-capsule__creator">
            <img src={avatarUrl(props.capsule.creator.avatarId)} alt="" />
            {props.capsule.creator.nickname}
          </span>
        </Show>
        <Show when={props.rightSlot} fallback={
          <Show when={!props.hideFavorite}>
            <FavoriteButton capsule={props.capsule} />
          </Show>
        }>
          {props.rightSlot}
        </Show>
      </div>
    </article>
  );
}
