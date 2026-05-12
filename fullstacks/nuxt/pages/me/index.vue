<script setup lang="ts">
definePageMeta({
  layout: "me",
  middleware: "auth-client",
});

await navigateTo("/me/created");
</script>

<template>
  <span />
</template>
