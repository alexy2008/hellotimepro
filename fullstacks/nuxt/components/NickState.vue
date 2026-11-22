<!-- 昵称右侧的状态点：格式通过打勾，不通过（或重名）打叉 -->
<script setup lang="ts">
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";
import AppIcon from "@/components/AppIcon.vue";
import type { NickStateValue } from "@/composables/useAccount";

const props = defineProps<{ state: NickStateValue }>();
const ui = useUiStore();
const good = computed(() => props.state === "valid");
const bad = computed(() => props.state === "invalid" || props.state === "taken");
</script>

<template>
  <span
    :class="[ui.skin === 'paper' ? 'field__state' : 'input-wrap__action nick-state', { 'is-good': good, 'is-bad': bad }]"
    aria-hidden="true"
    :data-testid="state ? 'nickname-state' : undefined"
    :data-state="state || undefined"
  >
    <AppIcon v-if="good" name="check" />
    <AppIcon v-else-if="bad" name="x" />
  </span>
</template>
