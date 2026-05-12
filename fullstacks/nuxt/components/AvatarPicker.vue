<script setup lang="ts">
import type { Avatar } from "@/types";
import { avatarUrl } from "@/utils/avatar";

defineProps<{
  avatars: Avatar[];
  modelValue: string | null;
}>();

defineEmits<{
  (e: "update:modelValue", id: string): void;
}>();
</script>

<template>
  <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
    <button
      v-for="a in avatars"
      :key="a.id"
      type="button"
      role="radio"
      :aria-checked="modelValue === a.id"
      :class="['cy-avatar-picker__item', modelValue === a.id ? 'is-selected' : '']"
      :title="a.name"
      @click="$emit('update:modelValue', a.id)"
    >
      <img :src="a.svgUrl ?? avatarUrl(a.id)" :alt="a.name" />
    </button>
  </div>
</template>
