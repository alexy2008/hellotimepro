<!-- 创建（/create）：路由持有表单、提交锁与回执；外层 AuthGate 按 user.id 加了 {#key} -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import { provideCreateForm } from "@/state/create-form.svelte.ts";
  import PaperCreatePage from "@/skins/paper/PaperCreatePage.svelte";
  import AmberCreatePage from "@/skins/amber/AmberCreatePage.svelte";

  provideCreateForm();
</script>

{#if ui.skin === "paper"}<PaperCreatePage />{:else}<AmberCreatePage />{/if}
