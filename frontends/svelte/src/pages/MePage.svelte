<!-- ============================================================
     「我的」（/me/:tab）：三个页签共用这一个路由组件——切页签只是参数变化，
     页头统计与资料表单不重新创建；离开「账号设置」页签时资料改回、密码框清空。
     页签名由 App 先校验过（只认 created / favorites / profile）。
     ============================================================ -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { MyStatsState, ProfileForm, provideMe, type MeTab } from "@/state/account.svelte.ts";
  import PaperMePage from "@/skins/paper/PaperMePage.svelte";
  import AmberMePage from "@/skins/amber/AmberMePage.svelte";

  let { tab }: { tab: MeTab } = $props();

  const stats = new MyStatsState();
  const profile = new ProfileForm();
  provideMe({
    get tab() {
      return tab;
    },
    stats,
    profile,
  });

  $effect(() => {
    if (tab !== "profile") profile.reset();
  });
</script>

{#if ui.skin === "paper"}<PaperMePage />{:else}<AmberMePage />{/if}
