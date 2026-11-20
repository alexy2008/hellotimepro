<!-- 空状态：一枚打开（或合上）的胶囊 + 标题 + 说明 + 插槽里的按钮 -->
<script setup lang="ts">
import AmberCapsuleArt from "./AmberCapsuleArt.vue";

withDefaults(defineProps<{ title: string; text: string; state?: "locked" | "opened"; testid?: string }>(), {
  state: "opened",
  testid: "list-empty",
});
</script>

<template>
  <div class="empty" :data-testid="testid">
    <AmberCapsuleArt :code="null" :state="state" :width="170" class="empty__art" />
    <h3 class="empty__title">{{ title }}</h3>
    <p>{{ text }}</p>
    <slot />
  </div>
</template>
