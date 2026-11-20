<!-- 密码规则：至少 8 位 / 含字母 / 含数字，满足的那条点亮 -->
<script setup lang="ts">
import { computed } from "vue";
import { pwdRules } from "@/composables/useAccount";

const props = defineProps<{ value: string }>();
const r = computed(() => pwdRules(props.value));
</script>

<template>
  <ul class="rules" aria-hidden="true">
    <li :class="{ 'is-ok': r.len }">至少 8 位</li>
    <li :class="{ 'is-ok': r.alpha }">含字母</li>
    <li :class="{ 'is-ok': r.digit }">含数字</li>
  </ul>
</template>
