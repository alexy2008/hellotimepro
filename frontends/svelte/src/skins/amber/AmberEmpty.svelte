<!-- 空状态：一枚打开（或合上）的胶囊 + 标题 + 说明 + children 里的按钮 -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";

  let {
    title,
    text,
    state: artState = "opened",
    testid = "list-empty",
    children,
  }: { title: string; text: string; state?: "locked" | "opened"; testid?: string; children?: Snippet } = $props();
</script>

<div class="empty" data-testid={testid}>
  <AmberCapsuleArt code={null} state={artState} width={170} class="empty__art" />
  <h3 class="empty__title">{title}</h3>
  <p>{text}</p>
  {@render children?.()}
</div>
