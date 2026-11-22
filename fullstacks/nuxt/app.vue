<script setup lang="ts">
const route = useRoute();
const ui = useUiStore();

useHead({
  htmlAttrs: { "data-skin": () => ui.skin, "data-theme": () => ui.theme },
  bodyAttrs: {
    "data-route": () => {
      if (route.path === "/") return "plaza";
      if (route.path.startsWith("/capsules/")) return "capsule";
      return route.path.split("/")[1];
    },
  },
  title: () => String(route.meta.title ?? "把此刻寄给未来"),
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
