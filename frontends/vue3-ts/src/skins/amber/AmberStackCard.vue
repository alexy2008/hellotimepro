<!-- 关于页的技术栈卡 -->
<script setup lang="ts">
import { ROLE_LABEL, TECH_NOTE } from "@/lib/about";
import TechIcon from "@/components/TechIcon.vue";
import type { StackItem } from "@/types";

defineProps<{ kind: string; en: string; path: string; items: StackItem[]; summary: string }>();
</script>

<template>
  <article class="card card--pad stack-card">
    <div class="eyebrow">{{ en }}</div>
    <h2 class="card__title">{{ kind }}<small class="mono">{{ path }}</small></h2>
    <p class="card__lead">{{ summary }}</p>
    <ul class="stack-list">
      <li v-for="it in items" :key="it.role + it.name" data-testid="stack-item" :data-name="it.name">
        <span class="stack-list__ic"><TechIcon :item="it" base="tech-ic" /></span>
        <div>
          <b>{{ it.name }}<small class="mono">{{ it.version }}</small></b>
          <span>{{ TECH_NOTE[it.name] ?? "" }}</span>
        </div>
        <em>{{ ROLE_LABEL[it.role] ?? it.role }}</em>
      </li>
    </ul>
  </article>
</template>
