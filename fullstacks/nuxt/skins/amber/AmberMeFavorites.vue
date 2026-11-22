<!-- 「我收藏的」：胶囊卡片网格；在这里取消收藏会从列表里拿掉 -->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useMyList } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import ListMore from "@/components/ListMore.vue";
import AmberCard from "./AmberCard.vue";
import AmberEmpty from "./AmberEmpty.vue";

defineProps<{ now: number }>();
const emit = defineEmits<{ change: [] }>();
const auth = useAuthStore();
const { items, total, hasMore, moreBusy, loadMore, onFavChange } = useMyList("favorites", () => emit("change"));
</script>

<template>
  <template v-if="items">
    <AmberEmpty v-if="!items.length" state="locked" title="还没有收藏" text="去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。">
      <NuxtLink class="btn btn--primary" to="/">去广场逛逛<AppIcon name="arrow" /></NuxtLink>
    </AmberEmpty>
    <template v-else>
      <div class="me__sub">
        <span>按收藏时间倒序 · 共 {{ total }} 枚</span>
        <NuxtLink class="btn btn--ghost btn--sm" to="/">去广场逛逛</NuxtLink>
      </div>
      <div class="grid">
        <AmberCard
          v-for="(c, i) in items"
          :key="c.id"
          :c="c"
          :i="i"
          :now="now"
          :mine="auth.user?.nickname === c.creator.nickname"
          test-id="fav-item"
          open-test-id="row-open"
          @fav-change="(f) => onFavChange(c.id, f)"
        />
      </div>
      <ListMore :show="hasMore" :busy="moreBusy" :left="total - items.length" @more="loadMore" />
    </template>
  </template>
</template>
