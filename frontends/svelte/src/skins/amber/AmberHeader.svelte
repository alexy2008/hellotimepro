<!-- ============================================================
     「琥珀」悬浮胶囊顶栏：品牌 · 导航（高亮底跟着当前页滑动）· 皮肤开关 · 星夜 / 晨曦开关 · 账号
     结构与类名照 2.0 原型 amber/shell.js；样式在 spec/styles/amber/components.css
     ============================================================ -->
<script lang="ts">
  import { useLocation } from "svelte-routing";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { themeOrigin, ui } from "@/stores/ui.svelte.ts";
  import { navAttrs, navKey, type NavKey } from "@/lib/nav";
  import { slider } from "@/lib/attach";
  import CreateLink from "@/components/CreateLink.svelte";
  import SkinSwitch from "@/components/SkinSwitch.svelte";
  import UserMenu from "@/components/UserMenu.svelte";
  import AmberLogo from "./AmberLogo.svelte";

  const NAV: Array<[Exclude<NavKey, null | "me">, string, string]> = [
    ["plaza", "/", "胶囊广场"],
    ["create", "/create", "写一枚"],
    ["open", "/open", "开启胶囊"],
    ["about", "/about", "关于"],
  ];

  const location = useLocation();
  const cur = $derived(navKey($location.pathname));
  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />

<header class={["hdr", scrollY > 6 && "is-scrolled"]}>
  <div class="hdr__bar">
    <a class="brand" href="/" aria-label="HelloTime Pro 首页">
      <AmberLogo size={34} />
      <span class="brand__name">HelloTime<small>PRO</small></span>
    </a>
    <!-- 导航高亮底：跟着当前页滑过去（首次定位不带过渡；登录态变化会改变顶栏宽度） -->
    <nav class="nav" aria-label="主导航" {@attach slider(".nav__link.is-active", ".nav__ink", () => [cur, authStore.user], true)}>
      <span class="nav__ink" aria-hidden="true"></span>
      {#each NAV as [k, to, label] (k)}
        {#if k === "create"}
          <CreateLink data-testid="nav-create" {...navAttrs(k, cur, "nav__link")}>{label}</CreateLink>
        {:else}
          <a href={to} data-testid={`nav-${k}`} {...navAttrs(k, cur, "nav__link")}>{label}</a>
        {/if}
      {/each}
    </nav>
    <div class="hdr__tools">
      <SkinSwitch />
      <button
        class="theme-toggle"
        type="button"
        role="switch"
        data-testid="theme-toggle"
        aria-checked={ui.theme === "light"}
        aria-label={ui.theme === "light" ? "当前为晨曦（亮色），切换到星夜" : "当前为星夜（暗色），切换到晨曦"}
        onclick={(e) => ui.toggleTheme(themeOrigin(e))}
      >
        <span class="theme-toggle__stars"></span>
        <span class="theme-toggle__cloud"></span>
        <span class="theme-toggle__knob"></span>
      </button>
      {#if authStore.user}
        <UserMenu createdIcon="feather" />
      {:else}
        <a class="btn btn--ghost btn--sm hdr__login" href="/login" data-testid="nav-login">登录</a>
        <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">注册</a>
      {/if}
    </div>
  </div>
</header>
