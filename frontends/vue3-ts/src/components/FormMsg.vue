<!-- 表单下方的一行结果：已保存 / 没有改动 / 出错 -->
<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import type { FormMsg } from "@/composables/useAccount";

defineProps<{ m: FormMsg }>();
</script>

<template>
  <div :class="['form__msg', m && `is-${m.type}`]" role="status">
    <template v-if="m">
      <AppIcon :name="m.type === 'err' ? 'alert' : m.type === 'ok' ? 'check' : 'info'" />
      <span>{{ m.text }}</span>
    </template>
  </div>
</template>
