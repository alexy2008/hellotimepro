<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
import CapsuleGrid from "@/components/CapsuleGrid.vue";
import Pagination from "@/components/Pagination.vue";
import { fmtNumber } from "@/utils/format";

const PAGE_SIZE = 15;

const items = ref<CapsuleListItem[]>([]);
const pagination = ref<PaginationT | null>(null);
const page = ref(1);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const r = await api.myCapsules(page.value, PAGE_SIZE);
    items.value = r.items;
    pagination.value = r.pagination;
  } finally {
    loading.value = false;
  }
}

watch(page, load, { immediate: true });

async function withdraw(id: string) {
  const sure = window.confirm("确认撤回？此操作不可恢复。");
  if (!sure) return;
  try {
    await api.deleteMyCapsule(id);
    items.value = items.value.filter((c) => c.id !== id);
  } catch (e) {
    alert(e instanceof Error ? e.message : "撤回失败");
  }
}
</script>

<template>
  <h1>我创建的胶囊</h1>

  <div class="cy-toolbar" style="border-bottom: none; padding-top: 0">
    <span style="color: var(--color-text-muted); font-size: var(--font-size-sm)">
      按创建时间倒序 · 共 {{ pagination?.total ?? 0 }} 条
    </span>
    <RouterLink class="cy-btn cy-btn--primary cy-btn--sm" to="/create">
      + 新建胶囊
    </RouterLink>
  </div>

  <CapsuleGrid
    :items="items"
    :loading="loading"
    :show-creator="false"
    hide-favorite
  >
    <template #empty>
      <div class="cy-empty">
        <div class="cy-empty__emoji">📭</div>
        <p>还没有创建任何胶囊</p>
        <RouterLink class="cy-btn cy-btn--primary cy-btn--sm" to="/create" style="margin-top: var(--space-3)">
          去创建一个
        </RouterLink>
      </div>
    </template>
    <template #card="{ capsule: c }">
      <span v-if="c.isOpened" style="color: var(--color-favorite-active)">
        ♥ {{ fmtNumber(c.favoriteCount) }}
      </span>
      <button
        v-else
        type="button"
        class="cy-btn cy-btn--ghost cy-btn--sm"
        style="min-height: 28px; padding: 4px 12px; color: var(--color-danger-fg)"
        @click="withdraw(c.id)"
      >
        撤回
      </button>
    </template>
  </CapsuleGrid>

  <Pagination
    :page="page"
    :total-pages="pagination?.totalPages ?? 0"
    @change="page = $event"
  />
</template>
