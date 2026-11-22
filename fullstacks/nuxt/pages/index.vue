<script setup lang="ts">
import type { Envelope, PaginatedCapsules, PlazaStats } from "@/types";
import PaperPage from "@/skins/paper/PaperHomePage.vue";
import AmberPage from "@/skins/amber/AmberHomePage.vue";

definePageMeta({ title: "把此刻寄给未来" });
const ui = useUiStore();
provideCodeOpen();

const plaza = usePlazaStore();
const auth = useAuthStore();
const nuxt = useNuxtApp();
const initial = import.meta.server || nuxt.isHydrating;
if (initial) {
  const { data } = await useAsyncData("plaza:initial", async () => {
    const [list, stats, featured] = await Promise.all([
      $fetch<Envelope<PaginatedCapsules>>("/api/v1/plaza/capsules", { query: { pageSize: plaza.pageSize } }),
      $fetch<Envelope<PlazaStats>>("/api/v1/plaza/stats"),
      $fetch<Envelope<PaginatedCapsules>>("/api/v1/plaza/capsules", {
        query: { sort: "hot", filter: "unopened", pageSize: 1 },
      }),
    ]);
    return { list: list.data, stats: stats.data, featured: featured.data?.items[0] ?? null };
  });
  if (data.value) {
    plaza.items = data.value.list?.items ?? [];
    plaza.pagination = data.value.list?.pagination ?? null;
    plaza.overview = data.value.stats;
    plaza.counts = data.value.stats?.counts ?? null;
    plaza.featured = data.value.featured;
  }
}

onMounted(() => {
  if (!initial || !plaza.pagination || auth.user) void plaza.refreshAll();
});
watch(() => auth.user?.id, () => void plaza.refreshAll());
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
