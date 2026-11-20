<script setup lang="ts">
import AmberBadge from "./AmberBadge.vue";

defineProps<{ inPlaza: boolean }>();
</script>

<template>
  <AmberBadge v-if="inPlaza" kind="plaza" icon="globe">广场公开</AmberBadge>
  <AmberBadge v-else kind="private" icon="lock">仅凭码可见</AmberBadge>
</template>
