<script lang="ts">
  import { link } from "svelte-routing";
  import { plazaStore } from "@/stores/plaza.svelte.ts";
  import { authStore } from "@/stores/auth.svelte.ts";
  import PlazaToolbar from "@/components/PlazaToolbar.svelte";
  import CapsuleGrid from "@/components/CapsuleGrid.svelte";
  import Pagination from "@/components/Pagination.svelte";
  import { fmtNumber } from "@/utils/format";

  const heroLink = $derived(authStore.user ? "/create" : "/register");
  const emptyLink = $derived(authStore.user ? "/create" : "/register");

  // 等鉴权 hydrate 完再请求，让 favoritedByMe 投影正确
  $effect(() => {
    if (authStore.hydrated) void plazaStore.fetch();
  });
</script>

<section class="cy-hero-block">
  <div class="cy-container">
    <h1 class="cy-hero-title">
      封存此刻 <span class="cy-hero-title__highlight">开启未来</span>
    </h1>
    <p class="cy-hero-subtitle">
      写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
    </p>
    <div class="cy-hero-cta">
      <a href={heroLink} use:link class="cy-btn cy-btn--primary cy-btn--hero">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
        </svg>
        创建我的胶囊
      </a>
      <a href="/open" use:link class="cy-btn cy-btn--success cy-btn--hero">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
        用胶囊码开启
      </a>
    </div>
  </div>
</section>

<main class="cy-container">
  <PlazaToolbar />
  <CapsuleGrid
    items={plazaStore.items}
    loading={plazaStore.loading}
    hrefFn={(c) => `/plaza/${c.id}`}
  >
    {#snippet empty()}
      <div class="cy-empty">
        <div class="cy-empty__emoji">🌌</div>
        <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
        <a
          href={emptyLink}
          use:link
          class="cy-btn cy-btn--primary cy-btn--sm"
          style:margin-top="var(--space-3)"
        >
          {authStore.user ? "创建胶囊" : "注册并创建"}
        </a>
      </div>
    {/snippet}
  </CapsuleGrid>

  <Pagination
    page={plazaStore.page}
    totalPages={plazaStore.pagination?.totalPages ?? 0}
    extra={plazaStore.pagination ? `共 ${fmtNumber(plazaStore.pagination.total)} 条` : ""}
    margin="var(--space-10) 0 var(--space-6)"
    onChange={(p) => plazaStore.setPage(p)}
  />
</main>
