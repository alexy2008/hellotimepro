<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperLoginPage.vue";
import AmberPage from "@/skins/amber/AmberLoginPage.vue";

definePageMeta({ title: "登录", middleware: "session", guestOnly: true });
const ui = useUiStore();
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
