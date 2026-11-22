<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import type { IconName } from "@/lib/icons";

defineProps<{ kind: string; icon?: IconName }>();
</script>

<template>
  <span :class="['badge', `badge--${kind}`]"><AppIcon v-if="icon" :name="icon" /><slot /></span>
</template>
