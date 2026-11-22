<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperRegisterPage.vue";
import AmberPage from "@/skins/amber/AmberRegisterPage.vue";

definePageMeta({ title: "注册", middleware: "session", guestOnly: true });
const ui = useUiStore();
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
