<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperOpenPage.vue";
import AmberPage from "@/skins/amber/AmberOpenPage.vue";

definePageMeta({ title: "开启胶囊" });
const ui = useUiStore();
provideCodeOpen();
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
