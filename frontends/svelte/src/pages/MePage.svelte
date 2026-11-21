<!-- ============================================================
     「我的」（/me/:tab）：三个页签共用这一个路由组件——切页签只是参数变化，
     页头统计与资料表单不重新创建；离开「账号设置」页签时资料改回、密码框清空。
     页签名由 App 先校验过（只认 created / favorites / profile）。
     ============================================================ -->
<script lang="ts">
  import { untrack } from "svelte";
  import { ui } from "@/stores/ui.svelte.ts";
  import { MyList, MyStatsState, ProfileForm, provideMe, type MeTab } from "@/state/account.svelte.ts";
  import PaperMePage from "@/skins/paper/PaperMePage.svelte";
  import AmberMePage from "@/skins/amber/AmberMePage.svelte";

  let { tab }: { tab: MeTab } = $props();

  const stats = new MyStatsState();
  const profile = new ProfileForm();
  const created = new MyList("created", stats.refresh);
  const favorites = new MyList("favorites", stats.refresh);
  provideMe({
    get tab() {
      return tab;
    },
    stats,
    profile,
    created,
    favorites,
  });

  $effect(() => {
    if (tab === "profile") return;
    profile.reset();
    const list = tab === "created" ? created : favorites;
    untrack(() => void list.reload());
  });
</script>

{#if ui.skin === "paper"}<PaperMePage />{:else}<AmberMePage />{/if}
