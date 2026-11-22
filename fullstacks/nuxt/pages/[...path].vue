<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperNotFoundPage.vue";
import AmberPage from "@/skins/amber/AmberNotFoundPage.vue";

definePageMeta({ title: "查无此页" });
const ui = useUiStore();
if (import.meta.server) setResponseStatus(404);
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
