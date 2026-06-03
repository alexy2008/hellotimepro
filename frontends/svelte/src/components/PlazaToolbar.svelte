<script lang="ts">
  import { plazaStore } from "@/stores/plaza.svelte.ts";
  import { createDebounced } from "@/lib/debounce.svelte.ts";
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

  let draft = $state(plazaStore.q);
  const debounced = createDebounced(() => draft, 300);

  $effect(() => {
    const v = debounced.value;
    if (v !== plazaStore.q) plazaStore.setQ(v);
  });
</script>

<div class="cy-toolbar">
  <div class="cy-toolbar__group">
    <div class="cy-seg">
      {#each SORTS as s (s.key)}
        <button
          type="button"
          class={s.key === plazaStore.sort ? "cy-seg__active" : ""}
          onclick={() => plazaStore.setSort(s.key)}
        >
          {s.label}
        </button>
      {/each}
    </div>
    <div class="cy-seg">
      {#each FILTERS as f (f.key)}
        <button
          type="button"
          class={f.key === plazaStore.filter ? "cy-seg__active" : ""}
          onclick={() => plazaStore.setFilter(f.key)}
        >
          {f.label}
        </button>
      {/each}
    </div>
  </div>
  <label class="cy-search" aria-label="搜索胶囊">
    <span class="cy-search__icon" aria-hidden="true">🔍</span>
    <input
      type="search"
      class="cy-search__input"
      placeholder="搜索标题或昵称…"
      maxlength="50"
      bind:value={draft}
    />
  </label>
</div>
