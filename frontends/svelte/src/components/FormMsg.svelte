<!-- 表单下方的一行结果：已保存 / 没有改动 / 出错 -->
<script lang="ts">
  import AppIcon from "@/components/AppIcon.svelte";
  import type { FormMsg } from "@/lib/account";

  let { m }: { m: FormMsg } = $props();
</script>

<div class={["form__msg", m && `is-${m.type}`]} role="status">
  {#if m}
    <AppIcon name={m.type === "err" ? "alert" : m.type === "ok" ? "check" : "info"} />
    <span>{m.text}</span>
  {/if}
</div>
