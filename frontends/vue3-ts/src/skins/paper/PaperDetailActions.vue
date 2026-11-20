<!-- 详情页底部：收藏 · 复制胶囊码 · 分享链接 -->
<script setup lang="ts">
import type { CapsuleDetail } from "@/types";
import { useShare } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import FavButton from "@/components/FavButton.vue";

const props = defineProps<{ c: CapsuleDetail }>();
const { copyCode, copyLink } = useShare(() => props.c.code);
</script>

<template>
  <div class="detail__actions">
    <FavButton :capsule="c" size="md" />
    <button class="btn btn--ghost" type="button" data-testid="copy-code" @click="copyCode"><AppIcon name="copy" />复制胶囊码</button>
    <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink"><AppIcon name="link" />分享链接</button>
  </div>
</template>
