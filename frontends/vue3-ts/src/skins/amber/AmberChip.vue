<script setup lang="ts">
import { ROLE_LABEL } from "@/lib/about";
import TechIcon from "@/components/TechIcon.vue";
import type { StackItem } from "@/types";

defineProps<{ it: StackItem }>();
</script>

<template>
  <span class="ftr__tech" :title="`${ROLE_LABEL[it.role] ?? it.role} · ${it.name} ${it.version ?? ''}`" data-testid="stack-item" :data-name="it.name">
    <TechIcon :item="it" base="tech-ic" />
    {{ it.name }}
  </span>
</template>
