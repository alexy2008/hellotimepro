import { For, Show, type JSX } from "solid-js";
import { CapsuleCard } from "./CapsuleCard";
import type { CapsuleListItem } from "@/types";

export function CapsuleGrid(props: {
  items: CapsuleListItem[];
  loading?: boolean;
  emptyHint?: JSX.Element;
  showCreator?: boolean;
  hideFavorite?: boolean;
  cardSlot?: (capsule: CapsuleListItem) => JSX.Element;
}) {
  return (
    <Show
      when={!(props.loading && props.items.length === 0)}
      fallback={
        <div class="cy-empty">
          <div class="cy-empty__emoji">⏳</div>
          <p>加载中…</p>
        </div>
      }
    >
      <Show
        when={props.items.length > 0}
        fallback={
          props.emptyHint ?? (
            <div class="cy-empty">
              <p>暂无数据</p>
            </div>
          )
        }
      >
        <div class="cy-grid">
          <For each={props.items}>
            {(c) => (
              <CapsuleCard
                capsule={c}
                showCreator={props.showCreator}
                hideFavorite={props.hideFavorite}
                rightSlot={props.cardSlot?.(c)}
              />
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
