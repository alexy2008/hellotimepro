<!-- 「我收藏的」：信封卡片网格；在这里取消收藏会从列表里拿掉 -->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useMyList } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import ListMore from "@/components/ListMore.vue";
import ListStatus from "@/components/ListStatus.vue";
import PaperCard from "./PaperCard.vue";
import PaperSeal from "./PaperSeal.vue";

defineProps<{ now: number }>();
const emit = defineEmits<{ change: [] }>();
const auth = useAuthStore();
const { items, error, reload, total, hasMore, moreBusy, loadMore, onFavChange } = useMyList("favorites", () => emit("change"));
</script>

<template>
  <template v-if="items">
    <div v-if="!items.length" class="empty empty--inline" data-testid="list-empty">
      <PaperSeal ch="藏" variant="line" />
      <h3>还没有收藏</h3>
      <p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p>
      <NuxtLink class="btn btn--primary" to="/">去广场逛逛<AppIcon name="arrow" class="ic--go" /></NuxtLink>
    </div>
    <template v-else>
      <div class="me__bar">
        <span>按收藏时间倒序 · 共 {{ total }} 枚</span>
        <NuxtLink class="btn btn--ghost btn--sm" to="/">去广场逛逛</NuxtLink>
      </div>
      <div class="grid grid--me">
        <PaperCard
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
  <ListStatus v-else :error="error" @retry="reload" />
</template>
