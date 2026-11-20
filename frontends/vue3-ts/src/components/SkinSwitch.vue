<!-- 皮肤切换：一组两个单选项（两套皮肤长得不一样，结构相同） -->
<script setup lang="ts">
import { SKIN_LABEL, SKINS, useUiStore, type Skin } from "@/stores/ui";
import { toast } from "@/stores/feedback";

const ui = useUiStore();
function pick(k: Skin) {
  if (k === ui.skin) return;
  void ui.setSkin(k).then(() => toast(`已切换到「${SKIN_LABEL[k]}」`));
}
</script>

<template>
  <div class="skinsw" role="radiogroup" aria-label="界面皮肤">
    <button
      v-for="k in SKINS"
      :key="k"
      type="button"
      role="radio"
      :aria-checked="ui.skin === k"
      :class="{ 'is-active': ui.skin === k }"
      :title="`切换到「${SKIN_LABEL[k]}」`"
      data-testid="skin-option"
      :data-value="k"
      :data-selected="ui.skin === k"
      @click="pick(k)"
    >
      {{ SKIN_LABEL[k] }}
    </button>
  </div>
</template>
