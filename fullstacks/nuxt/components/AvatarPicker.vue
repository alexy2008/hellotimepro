<!-- ============================================================
     头像选择：时笺是十枚邮票（选中的被盖上一枚带对勾的小邮戳），琥珀是十颗小星球。
     单选组：方向键在选项间移动。值用 v-model。
     ============================================================ -->
<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from "vue";
import { useUiStore } from "@/stores/ui";
import { avatarOf } from "@/lib/avatars";
import AppAvatar from "@/components/AppAvatar.vue";
import PaperAvatarStamp from "@/skins/paper/PaperAvatarStamp.vue";

const model = defineModel<string>({ required: true });
const props = defineProps<{ ids: string[] }>();
const ui = useUiStore();
const box = useTemplateRef<HTMLElement>("box");
const cur = computed(() => avatarOf(model.value));

function move(dir: number) {
  const ids = props.ids;
  if (!ids.length) return;
  const i = Math.max(0, ids.indexOf(model.value));
  const n = ids[(i + dir + ids.length) % ids.length];
  model.value = n;
  void nextTick(() => box.value?.querySelector<HTMLElement>(`[data-value="${n}"]`)?.focus());
}
</script>

<template>
  <div
    ref="box"
    class="avpick"
    role="radiogroup"
    aria-label="选择头像"
    @keydown.right.prevent="move(1)"
    @keydown.down.prevent="move(1)"
    @keydown.left.prevent="move(-1)"
    @keydown.up.prevent="move(-1)"
  >
    <button
      v-for="id in ids"
      :key="id"
      type="button"
      :class="['avpick__it', { 'is-sel': id === model }]"
      role="radio"
      :aria-checked="id === model"
      :tabindex="id === model ? 0 : -1"
      :aria-label="`${avatarOf(id).name}，${avatarOf(id).tagline}`"
      data-testid="avatar-option"
      :data-value="id"
      :data-selected="id === model"
      @click="model = id"
    >
      <template v-if="ui.skin === 'paper'">
        <PaperAvatarStamp :id="id" />
        <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
          <circle cx="51" cy="65" r="14.5" />
          <circle cx="51" cy="65" r="10.5" />
          <path d="M45.5 65.5l4 4 7.5-8.5" />
        </svg>
      </template>
      <template v-else>
        <AppAvatar :id="id" class="av--xl" />
        <span>{{ avatarOf(id).name }}</span>
      </template>
    </button>
  </div>
  <div class="avpick__cap">
    <AppAvatar v-if="ui.skin === 'amber'" :id="cur.id" />
    <b>{{ cur.name }}</b>
    <span>{{ cur.tagline }}</span>
  </div>
</template>
