<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";

defineProps<{ inPlaza: boolean }>();
</script>

<template>
  <span v-if="inPlaza" class="tag"><AppIcon name="globe" />广场公开</span>
  <span v-else class="tag tag--quiet"><AppIcon name="lock" />仅凭码可见</span>
</template>
