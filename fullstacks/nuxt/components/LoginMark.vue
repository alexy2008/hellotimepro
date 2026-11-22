<!-- 登录提示框顶部的小标记：时笺盖一枚朱文印，琥珀是一个图标 -->
<script setup lang="ts">
import { useUiStore } from "@/stores/ui";
import AppIcon from "@/components/AppIcon.vue";
import PaperSeal from "@/skins/paper/PaperSeal.vue";
import type { IconName } from "@/lib/icons";

defineProps<{ ch: string; icon: IconName }>();
const ui = useUiStore();
</script>

<template>
  <div class="dlg__mark">
    <PaperSeal v-if="ui.skin === 'paper'" :ch="ch" variant="line" />
    <AppIcon v-else :name="icon" />
  </div>
</template>
