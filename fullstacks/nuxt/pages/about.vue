<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperAboutPage.vue";
import AmberPage from "@/skins/amber/AmberAboutPage.vue";

definePageMeta({ title: "关于" });
const ui = useUiStore();
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
