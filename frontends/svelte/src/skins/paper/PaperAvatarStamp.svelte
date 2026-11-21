<!-- 邮票：头像徽记 + 齿孔边（label=false 时不写名字） -->
<script lang="ts">
  import { avatarOf } from "@/lib/avatars";

  let { id, label = true, class: cls = "" }: { id: string; label?: boolean; class?: string } = $props();
  const a = $derived(avatarOf(id));
</script>

<span class={["stamp", cls]} style:--av={a.color}>
  <span class="stamp__in">
    <svg viewBox="0 0 24 24" aria-hidden="true">{@html a.glyph}</svg>
    {#if label}<b>{a.name}</b>{/if}
  </span>
</span>
