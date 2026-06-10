<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { usePlazaStore } from "@/stores/plaza";
import { useAuthStore } from "@/stores/auth";
import PlazaToolbar from "@/components/PlazaToolbar.vue";
import CapsuleGrid from "@/components/CapsuleGrid.vue";
import Pagination from "@/components/Pagination.vue";
import { fmtNumber } from "@/utils/format";
import type { Envelope, PaginatedCapsules } from "@/types";

const plaza = usePlazaStore();
const auth = useAuthStore();
const { items, loading, pagination, page } = storeToRefs(plaza);
const { user, hydrated } = storeToRefs(auth);

const heroLink = computed(() => (user.value ? "/create" : "/register"));
const emptyLink = computed(() => (user.value ? "/create" : "/register"));

// 服务端预取首屏广场（按 store 当前默认 sort/filter/page），结果 seed 进 store，
// 模板照常绑定 store。useAsyncData 会把服务端取到的数据序列化进 payload，客户端
// hydrate 时直接复用、不重复请求。
// 注意：SSR 没有 Authorization 头 → favoritedByMe 一律 false；登录用户在客户端
// 再拉一次纠正投影（见下方 onMounted/watch）。匿名用户 SSR 数据即为最终结果。
const { data: ssrPlaza } = await useAsyncData("plaza:home", () =>
  $fetch<Envelope<PaginatedCapsules>>("/api/v1/plaza/capsules", {
    query: {
      sort: plaza.sort,
      filter: plaza.filter,
      page: plaza.page,
      pageSize: plaza.pageSize,
    },
  }),
);
if (ssrPlaza.value?.success && ssrPlaza.value.data) {
  plaza.items = ssrPlaza.value.data.items;
  plaza.pagination = ssrPlaza.value.data.pagination;
}

// 登录用户在客户端补取一次，让 favoritedByMe 投影正确；匿名用户沿用 SSR 数据，
// 不再重复请求（items 已非空，CapsuleGrid 也不会闪骨架屏）。
onMounted(() => {
  if (hydrated.value && user.value) void plaza.fetch();
});
watch(hydrated, (v) => {
  if (v && user.value) void plaza.fetch();
});
</script>

<template>
  <section class="cy-hero-block">
    <div class="cy-container">
      <h1 class="cy-hero-title">
        封存此刻 <span class="cy-hero-title__highlight">开启未来</span>
      </h1>
      <p class="cy-hero-subtitle">
        写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
      </p>
      <div class="cy-hero-cta">
        <RouterLink class="cy-btn cy-btn--primary cy-btn--hero" :to="heroLink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
          </svg>
          创建我的胶囊
        </RouterLink>
        <RouterLink class="cy-btn cy-btn--success cy-btn--hero" to="/open">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
          用胶囊码开启
        </RouterLink>
      </div>
    </div>
  </section>

  <main class="cy-container">
    <PlazaToolbar />
    <CapsuleGrid :items="items" :loading="loading">
      <template #empty>
        <div class="cy-empty">
          <div class="cy-empty__emoji">🌌</div>
          <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
          <RouterLink
            class="cy-btn cy-btn--primary cy-btn--sm"
            :to="emptyLink"
            style="margin-top: var(--space-3)"
          >
            {{ user ? "创建胶囊" : "注册并创建" }}
          </RouterLink>
        </div>
      </template>
    </CapsuleGrid>

    <Pagination
      :page="page"
      :total-pages="pagination?.totalPages ?? 0"
      :extra="pagination ? `共 ${fmtNumber(pagination.total)} 条` : ''"
      margin="var(--space-10) 0 var(--space-6)"
      @change="plaza.setPage($event)"
    />
  </main>
</template>
