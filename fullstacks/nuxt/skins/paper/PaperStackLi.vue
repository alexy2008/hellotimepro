<script setup lang="ts">
import { ROLE_LABEL } from "@/lib/about";
import TechIcon from "@/components/TechIcon.vue";
import type { StackItem } from "@/types";

defineProps<{ it: StackItem }>();
</script>

<template>
  <li :title="ROLE_LABEL[it.role] ?? it.role" data-testid="stack-item" :data-name="it.name">
    <TechIcon :item="it" base="tech__ic" />
    <span>{{ it.name }}</span>
    <small class="mono">{{ it.version }}</small>
  </li>
</template>
