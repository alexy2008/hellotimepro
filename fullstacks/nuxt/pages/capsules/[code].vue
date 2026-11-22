<script setup lang="ts">
import type { CapsuleDetail, Envelope } from "@/types";
import PaperPage from "@/skins/paper/PaperCapsulePage.vue";
import AmberPage from "@/skins/amber/AmberCapsulePage.vue";

const ui = useUiStore();
const route = useRoute();
const code = String(route.params.code ?? "");
const { data, error } = await useAsyncData(`capsule:${code}`, async () => {
  const response = await $fetch<Envelope<CapsuleDetail>>(`/api/v1/capsules/${encodeURIComponent(code)}`);
  return { capsule: response.data };
});
const { capsule } = provideCapsuleByCode(code, data.value?.capsule ?? null, error.value?.statusCode);
useHead({ title: () => capsule.value?.title ?? code });
</script>

<template>
  <component :is="ui.skin === 'paper' ? PaperPage : AmberPage" />
</template>
