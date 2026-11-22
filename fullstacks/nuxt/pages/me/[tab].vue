<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperMePage.vue";
import AmberPage from "@/skins/amber/AmberMePage.vue";

definePageMeta({ title: "我的", path: "/me/:tab(created|favorites|profile)", key: "me", middleware: "session", requiresAuth: true });
const ui = useUiStore();
const auth = useAuthStore();
</script>

<template>
  <component v-if="auth.user" :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
