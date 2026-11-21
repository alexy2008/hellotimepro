<!-- 注册（/register）：路由持有表单，切皮肤时已填的值不丢；离开路由即清空 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideRegister } from "@/state/account.svelte.ts";
  import PaperRegisterPage from "@/skins/paper/PaperRegisterPage.svelte";
  import AmberRegisterPage from "@/skins/amber/AmberRegisterPage.svelte";

  provideRegister();
</script>

{#if ui.skin === "paper"}<PaperRegisterPage />{:else}<AmberRegisterPage />{/if}
