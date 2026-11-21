<!-- ============================================================
     总布局：按当前皮肤挑外壳，中间是路由页面。
     外壳的 DOM 约定照 2.0 原型：header.hdr / main#view / footer.ftr / nav.tabbar，
     皮肤样式里有 #view、body[data-route] 等选择器依赖这些约定。
     「时笺」的 SVG 滤镜与「琥珀」的星空背景在这里各挂一次。
     路由用 svelte-routing：Route 平铺在同一个 Router 下（不嵌套），
     站内 <a> 由挂在 body 上的 links 统一接管，组件里直接写 href。
     ============================================================ -->
<script lang="ts">
  import { Router, Route, links } from "svelte-routing";
  import { ui } from "@/stores/ui.svelte.ts";
  import { authStore } from "@/stores/auth.svelte.ts";
  import { isMeTab } from "@/state/account.svelte.ts";
  import ToastHost from "@/components/ToastHost.svelte";
  import DialogHost from "@/components/DialogHost.svelte";
  import AuthGate from "@/components/AuthGate.svelte";
  import RouteMeta from "@/pages/RouteMeta.svelte";
  import Redirect from "@/pages/Redirect.svelte";
  import GuestOnly from "@/pages/GuestOnly.svelte";
  import PlazaPage from "@/pages/PlazaPage.svelte";
  import OpenPage from "@/pages/OpenPage.svelte";
  import AboutPage from "@/pages/AboutPage.svelte";
  import LoginPage from "@/pages/LoginPage.svelte";
  import RegisterPage from "@/pages/RegisterPage.svelte";
  import CreatePage from "@/pages/CreatePage.svelte";
  import CapsulePage from "@/pages/CapsulePage.svelte";
  import MePage from "@/pages/MePage.svelte";
  import NotFoundPage from "@/pages/NotFoundPage.svelte";
  import PaperFilters from "@/skins/paper/PaperFilters.svelte";
  import PaperHeader from "@/skins/paper/PaperHeader.svelte";
  import PaperFooter from "@/skins/paper/PaperFooter.svelte";
  import PaperTabBar from "@/skins/paper/PaperTabBar.svelte";
  import AmberBackdrop from "@/skins/amber/AmberBackdrop.svelte";
  import AmberHeader from "@/skins/amber/AmberHeader.svelte";
  import AmberFooter from "@/skins/amber/AmberFooter.svelte";
  import AmberTabBar from "@/skins/amber/AmberTabBar.svelte";

  const paper = $derived(ui.skin === "paper");

  // 站内链接交给路由（含挂到 body 下的仪式层、确认框）
  $effect(() => links(document.body).destroy);

  // 本地有 refresh token 时主动拉一次 /me，确认登录态仍然有效
  if (authStore.refreshToken) void authStore.refreshMe();
</script>

<PaperFilters />
<AmberBackdrop />
<a class="skip" href="#view" noroute>跳到正文</a>
<Router>
  <RouteMeta />
  {#if paper}<PaperHeader />{:else}<AmberHeader />{/if}
  <main id="view" tabindex="-1">
    <Route path="/"><PlazaPage /></Route>
    <Route path="/open"><OpenPage /></Route>
    <Route path="/about"><AboutPage /></Route>
    <Route path="/login"><GuestOnly><LoginPage /></GuestOnly></Route>
    <Route path="/register"><GuestOnly><RegisterPage /></GuestOnly></Route>
    <Route path="/create"><AuthGate><CreatePage /></AuthGate></Route>
    <Route path="/capsules/:code" let:params>
      {#key params.code}<CapsulePage code={params.code} />{/key}
    </Route>
    <Route path="/me"><Redirect to="/me/created" /></Route>
    <!-- 三个页签共用一条路由：切页签只是参数变化，页头与统计不重新挂载；其余 /me/* 回到「我创建的」 -->
    <Route path="/me/:tab" let:params>
      {#if isMeTab(params.tab)}<AuthGate><MePage tab={params.tab} /></AuthGate>{:else}<Redirect to="/me/created" />{/if}
    </Route>
    <Route path="/me/*"><Redirect to="/me/created" /></Route>
    <Route><NotFoundPage /></Route>
  </main>
  {#if paper}<PaperFooter />{:else}<AmberFooter />{/if}
  {#if paper}<PaperTabBar />{:else}<AmberTabBar />{/if}
</Router>
<ToastHost />
<DialogHost />

<style>
  /* 挂载点不参与布局：皮肤样式里 body 是纵向 flex，页头 / #view / 页脚是它的直接子项 */
  :global(#app) {
    display: contents;
  }
</style>
