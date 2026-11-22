<script setup lang="ts">
import PaperPage from "@/skins/paper/PaperCreatePage.vue";
import AmberPage from "@/skins/amber/AmberCreatePage.vue";

definePageMeta({ title: "写给未来", middleware: "session", requiresAuth: true });
const ui = useUiStore();
const auth = useAuthStore();
provideCreateForm();
</script>

<template>
  <component v-if="auth.user" :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
