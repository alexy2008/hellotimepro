<!-- 换个地址：/me、/me/a/b 之类回到「我创建的」 -->
<script lang="ts">
  import { onMount } from "svelte";
  import { redirect } from "@/lib/nav";

  let { to }: { to: string } = $props();
  onMount(() => redirect(to));
</script>
