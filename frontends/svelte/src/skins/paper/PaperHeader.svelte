<!-- ============================================================
     「时笺」页头：品牌 · 主导航 · 写一枚 · 皮肤开关 · 明暗 · 账号
     结构与类名照 2.0 原型 paper/shell.js；样式在 spec/styles/paper/components.css
     ============================================================ -->
<script lang="ts">
  import { useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { themeOrigin, ui } from "@/stores/ui.svelte.ts";
  import { navAttrs, navKey } from "@/lib/nav";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import SkinSwitch from "@/components/SkinSwitch.svelte";
  import UserMenu from "@/components/UserMenu.svelte";
  import PaperBrand from "./PaperBrand.svelte";

  const location = useLocation();
  const cur = $derived(navKey($location.pathname));
  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />

<header class={["hdr", scrollY > 6 && "is-scrolled"]}>
  <div class="wrap hdr__in">
    <PaperBrand label="HelloTime Pro 首页" />
    <nav class="nav" aria-label="主导航">
      <a href="/" data-testid="nav-plaza" {...navAttrs("plaza", cur)}>广场</a>
      <a href="/open" data-testid="nav-open" {...navAttrs("open", cur)}>开启</a>
      <a href="/about" data-testid="nav-about" {...navAttrs("about", cur)}>关于</a>
    </nav>
    <div class="hdr__act">
      <CreateLink data-testid="nav-create" {...navAttrs("create", cur, "btn btn--ghost btn--sm hdr__write")}>
        <AppIcon name="pen" />
        写一枚
      </CreateLink>
      <SkinSwitch />
      <button
        class="iconbtn theme"
        type="button"
        data-testid="theme-toggle"
        aria-label={ui.theme === "dark" ? "切换到日间主题" : "切换到夜间主题"}
        onclick={(e) => ui.toggleTheme(themeOrigin(e))}
      >
        <AppIcon name="sun" class="theme__sun" />
        <AppIcon name="moon" class="theme__moon" />
      </button>
      {#if authStore.user}
        <UserMenu createdIcon="mail" />
      {:else}
        <a class="btn btn--text hdr__login" href="/login" data-testid="nav-login">登录</a>
        <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">注册</a>
      {/if}
    </div>
  </div>
</header>
