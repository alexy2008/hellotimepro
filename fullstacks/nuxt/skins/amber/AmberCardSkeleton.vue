<script setup lang="ts">
defineProps<{ i: number }>();
</script>

<template>
  <div class="pc pc--skel" :style="{ '--i': i }" aria-hidden="true">
    <i class="sk" style="width: 150px; height: 62px; border-radius: 999px" />
    <i class="sk" style="width: 70%; height: 22px; margin-top: 30px" />
    <i class="sk" style="width: 45%; height: 13px; margin-top: 12px" />
    <i class="sk" style="width: 100%; height: 13px; margin-top: 22px" />
    <i class="sk" style="width: 82%; height: 13px; margin-top: 10px" />
    <i class="sk" style="width: 100%; height: 13px; margin-top: 30px" />
  </div>
</template>
