<!-- 头像：spec/avatars/v2 的单线徽记，颜色由 --av 与皮肤样式决定。
     徽记路径来自构建期内联的 spec 资源，不含用户输入，可以放心 {@html} -->
<script lang="ts">
  import { avatarOf } from "@/lib/avatars";

  let { id, class: cls = "" }: { id: string | null | undefined; class?: string } = $props();
  const a = $derived(avatarOf(id));
</script>

<span class={["av", cls]} style:--av={a.color} aria-hidden="true">
  <svg viewBox="0 0 24 24">{@html a.glyph}</svg>
</span>
