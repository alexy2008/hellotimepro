<script setup lang="ts">
import { ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePlazaStore } from "@/stores/plaza";
import { useDebouncedRef } from "@/composables/useDebouncedRef";
import type { PlazaFilter, PlazaSort } from "@/types";

const plaza = usePlazaStore();
const { sort, filter, q } = storeToRefs(plaza);

const SORTS: Array<{ key: PlazaSort; label: string }> = [
  { key: "hot", label: "🔥 热门" },
  { key: "new", label: "✨ 最新" },
];
const FILTERS: Array<{ key: PlazaFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "opened", label: "已开启" },
  { key: "unopened", label: "未开启" },
];

// 300ms 防抖：draft 是输入框 v-model，debounced 是真实推到 store 的值
const draft = ref(q.value);
const debounced = useDebouncedRef(draft, 300);
watch(debounced, (v) => {
  if (v !== plaza.q) plaza.setQ(v);
});
</script>

<template>
  <div class="cy-toolbar">
    <div class="cy-toolbar__group">
      <div class="cy-seg">
        <button
          v-for="s in SORTS"
          :key="s.key"
          type="button"
          :class="s.key === sort ? 'cy-seg__active' : ''"
          @click="plaza.setSort(s.key)"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="cy-seg">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          :class="f.key === filter ? 'cy-seg__active' : ''"
          @click="plaza.setFilter(f.key)"
        >
          {{ f.label }}
        </button>
      </div>
    </div>
    <label class="cy-search" aria-label="搜索胶囊">
      <span class="cy-search__icon" aria-hidden="true">🔍</span>
      <input
        v-model="draft"
        type="search"
        class="cy-search__input"
        placeholder="搜索标题或昵称…"
        :maxlength="50"
      />
    </label>
  </div>
</template>
