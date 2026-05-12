<script setup lang="ts">
import { ref, watch } from "vue";
import { api } from "@/api/client";
import type { CapsuleListItem, Pagination as PaginationT } from "@/types";
import CapsuleGrid from "@/components/CapsuleGrid.vue";
import Pagination from "@/components/Pagination.vue";

definePageMeta({ layout: "me", middleware: "auth-client" });

const PAGE_SIZE = 15;

const items = ref<CapsuleListItem[]>([]);
const pagination = ref<PaginationT | null>(null);
const page = ref(1);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const r = await api.myFavorites(page.value, PAGE_SIZE);
    items.value = r.items;
    pagination.value = r.pagination;
  } finally {
    loading.value = false;
  }
}

watch(page, load, { immediate: true });
</script>

<template>
  <h1>我收藏的胶囊</h1>
  <p style="color: var(--color-text-secondary); margin: 0 0 var(--space-6)">
    共 {{ pagination?.total ?? 0 }} 条；取消收藏只会从此列表移除，不会影响原胶囊。
  </p>

  <CapsuleGrid :items="items" :loading="loading">
    <template #empty>
      <div class="cy-empty">
        <div class="cy-empty__emoji">🗂</div>
        <p>还没有收藏任何胶囊 —— 去广场看看？</p>
        <RouterLink class="cy-btn cy-btn--ghost cy-btn--sm" to="/" style="margin-top: var(--space-3)">
          去广场
        </RouterLink>
      </div>
    </template>
  </CapsuleGrid>

  <Pagination
    :page="page"
    :total-pages="pagination?.totalPages ?? 0"
    @change="page = $event"
  />
</template>
