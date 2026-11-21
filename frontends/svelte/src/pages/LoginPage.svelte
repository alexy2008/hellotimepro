<!-- 登录（/login）：路由持有表单，切皮肤时已填的值不丢；离开路由即清空 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideLogin } from "@/state/account.svelte.ts";
  import PaperLoginPage from "@/skins/paper/PaperLoginPage.svelte";
  import AmberLoginPage from "@/skins/amber/AmberLoginPage.svelte";

  provideLogin();
</script>

{#if ui.skin === "paper"}<PaperLoginPage />{:else}<AmberLoginPage />{/if}
