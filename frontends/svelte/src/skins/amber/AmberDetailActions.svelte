<!-- 详情页的按钮组：收藏 · 复制胶囊码 · 分享链接（信笺页另有「我也写一枚」） -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { share } from "@/stores/feedback.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import { useCapsule } from "@/state/capsule.svelte.ts";
  import FavButton from "@/components/FavButton.svelte";

  let { c, letter = false }: { c: CapsuleDetail; letter?: boolean } = $props();
  const detail = useCapsule();
</script>

<div class="detail__actions">
  <FavButton capsule={c} size="md" onchange={detail.setFavorite} />
  <button class="btn btn--ghost" type="button" data-testid="copy-code" onclick={() => share.code(c.code)}><AppIcon name="copy" />复制胶囊码</button>
  <button class="btn btn--ghost" type="button" data-testid="copy-link" onclick={() => share.link(c.code)}><AppIcon name="link" />分享链接</button>
  {#if letter}<CreateLink class="btn btn--primary"><AppIcon name="pen" />我也写一枚</CreateLink>{/if}
</div>
