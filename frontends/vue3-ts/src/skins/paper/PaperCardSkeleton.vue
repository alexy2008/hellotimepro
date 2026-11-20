<script setup lang="ts">
defineProps<{ i: number }>();
</script>

<template>
  <div class="cap cap--skel" :style="{ '--i': i }" aria-hidden="true">
    <i class="sk sk--a" />
    <i class="sk sk--b" />
    <i class="sk sk--c" />
    <i class="sk sk--c2" />
    <i class="sk sk--d" />
  </div>
</template>
