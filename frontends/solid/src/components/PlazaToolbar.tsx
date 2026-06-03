import { createEffect, createSignal, For, onCleanup } from "solid-js";
import { plaza, setSort, setFilter, setQ } from "@/stores/plaza";
import type { PlazaFilter, PlazaSort } from "@/types";

const SORTS: Array<{ key: PlazaSort; label: string }> = [
  { key: "hot", label: "🔥 热门" },
  { key: "new", label: "✨ 最新" },
];

const FILTERS: Array<{ key: PlazaFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "opened", label: "已开启" },
  { key: "unopened", label: "未开启" },
];

export function PlazaToolbar() {
  // 300ms 防抖
  const [draft, setDraft] = createSignal(plaza.q);
  createEffect(() => {
    const d = draft();
    const t = setTimeout(() => {
      if (d !== plaza.q) setQ(d);
    }, 300);
    onCleanup(() => clearTimeout(t));
  });

  return (
    <div class="cy-toolbar">
      <div class="cy-toolbar__group">
        <div class="cy-seg">
          <For each={SORTS}>
            {(s) => (
              <button
                type="button"
                class={s.key === plaza.sort ? "cy-seg__active" : ""}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            )}
          </For>
        </div>
        <div class="cy-seg">
          <For each={FILTERS}>
            {(f) => (
              <button
                type="button"
                class={f.key === plaza.filter ? "cy-seg__active" : ""}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            )}
          </For>
        </div>
      </div>
      <label class="cy-search" aria-label="搜索胶囊">
        <span class="cy-search__icon" aria-hidden="true">🔍</span>
        <input
          type="search"
          class="cy-search__input"
          placeholder="搜索标题或昵称…"
          maxlength={50}
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
