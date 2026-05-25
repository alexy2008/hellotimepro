<script lang="ts">
  import { Router, Route } from "svelte-routing";
  import MainLayout from "@/components/MainLayout.svelte";
  import MeLayout from "@/components/MeLayout.svelte";
  import AuthGate from "@/components/AuthGate.svelte";

  import PlazaPage from "@/pages/PlazaPage.svelte";
  import OpenPage from "@/pages/OpenPage.svelte";
  import AboutPage from "@/pages/AboutPage.svelte";
  import LoginPage from "@/pages/LoginPage.svelte";
  import RegisterPage from "@/pages/RegisterPage.svelte";
  import CreatePage from "@/pages/CreatePage.svelte";
  import CapsuleByCodePage from "@/pages/CapsuleByCodePage.svelte";
  import PlazaDetailPage from "@/pages/PlazaDetailPage.svelte";
  import MeCreatedPage from "@/pages/MeCreatedPage.svelte";
  import MeFavoritesPage from "@/pages/MeFavoritesPage.svelte";
  import MeProfilePage from "@/pages/MeProfilePage.svelte";
  import NotFoundPage from "@/pages/NotFoundPage.svelte";

  import { authStore } from "@/stores/auth.svelte.ts";
  import { themeStore } from "@/stores/theme.svelte.ts";

  // 应用启动时 hydrate theme / auth；
  // 若本地有 refresh token 但还没拿到完整 user，则主动拉一次 /me 校验登录态。
  // 注意：hydrate 只跑一次，所以放在 onMount-like 的 $effect.root 替代里更稳妥；
  // 这里用 $effect 因为只在客户端 mount 后执行。
  $effect(() => {
    themeStore.hydrate();
    authStore.hydrate();
  });

  $effect(() => {
    if (authStore.hydrated && authStore.refreshToken && !authStore.user) {
      void authStore.refreshMe();
    }
  });
</script>

<Router>
  <Route path="/"><MainLayout><PlazaPage /></MainLayout></Route>
  <Route path="/open"><MainLayout><OpenPage /></MainLayout></Route>
  <Route path="/about"><MainLayout><AboutPage /></MainLayout></Route>
  <Route path="/login"><MainLayout><LoginPage /></MainLayout></Route>
  <Route path="/register"><MainLayout><RegisterPage /></MainLayout></Route>
  <Route path="/create">
    <MainLayout><AuthGate><CreatePage /></AuthGate></MainLayout>
  </Route>
  <Route path="/capsules/:code" let:params>
    <MainLayout><CapsuleByCodePage code={params.code} /></MainLayout>
  </Route>
  <Route path="/plaza/:id" let:params>
    <MainLayout><PlazaDetailPage id={params.id} /></MainLayout>
  </Route>

  <Route path="/me">
    <MeLayout><AuthGate><MeCreatedPage /></AuthGate></MeLayout>
  </Route>
  <Route path="/me/created">
    <MeLayout><AuthGate><MeCreatedPage /></AuthGate></MeLayout>
  </Route>
  <Route path="/me/favorites">
    <MeLayout><AuthGate><MeFavoritesPage /></AuthGate></MeLayout>
  </Route>
  <Route path="/me/profile">
    <MeLayout><AuthGate><MeProfilePage /></AuthGate></MeLayout>
  </Route>

  <!-- 兜底：未匹配到任何路径 -->
  <Route><MainLayout><NotFoundPage /></MainLayout></Route>
</Router>
