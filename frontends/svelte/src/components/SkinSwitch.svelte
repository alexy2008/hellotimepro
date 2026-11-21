<!-- 皮肤切换：一组两个单选项（两套皮肤长得不一样，结构相同） -->
<script lang="ts">
  import { SKIN_LABEL, SKINS, ui, type Skin } from "@/stores/ui.svelte.ts";
  import { toast } from "@/stores/feedback.svelte.ts";

  function pick(k: Skin) {
    if (k === ui.skin) return;
    void ui.setSkin(k).then(() => toast(`已切换到「${SKIN_LABEL[k]}」`));
  }
</script>

<div class="skinsw" role="radiogroup" aria-label="界面皮肤">
  {#each SKINS as k (k)}
    <button
      type="button"
      role="radio"
      aria-checked={ui.skin === k}
      class={{ "is-active": ui.skin === k }}
      title={`切换到「${SKIN_LABEL[k]}」`}
      data-testid="skin-option"
      data-value={k}
      data-selected={ui.skin === k}
      onclick={() => pick(k)}
    >
      {SKIN_LABEL[k]}
    </button>
  {/each}
</div>
