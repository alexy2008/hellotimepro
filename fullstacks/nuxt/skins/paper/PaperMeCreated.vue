<!-- 「我创建的」：一本账簿，每行一枚胶囊（含删除） -->
<script setup lang="ts">
import { h } from "vue";
import type { CapsuleListItem } from "@/types";
import { fmt, ms, pad2 } from "@/lib/fmt";
import { copyText } from "@/stores/feedback";
import { useMyList } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import CreateLink from "@/components/CreateLink.vue";
import ListMore from "@/components/ListMore.vue";
import ListStatus from "@/components/ListStatus.vue";
import PaperScale from "./PaperScale.vue";
import PaperSeal from "./PaperSeal.vue";

const props = defineProps<{ now: number }>();
const emit = defineEmits<{ change: [] }>();
const { items, error, reload, total, hasMore, moreBusy, loadMore, remove } = useMyList("created", () => emit("change"));

const row = (c: CapsuleListItem) => {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  return { openAt, createdAt, opened: c.isOpened || openAt <= props.now, cd: fmt.cd(openAt, props.now) };
};
/** 删除确认框顶上盖一枚「删」字朱文印 */
const mark = () => h("div", { class: "dlg__mark" }, h(PaperSeal, { ch: "删", variant: "line" }));
const copy = (code: string) => copyText(code, `已复制胶囊码 ${code}`);
</script>

<template>
  <template v-if="items">
    <div v-if="!items.length" class="empty empty--inline" data-testid="list-empty">
      <PaperSeal ch="空" variant="line" />
      <h3>还没有写下任何胶囊</h3>
      <p>第一封信，写给一年后的自己怎么样？</p>
      <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
    </div>
    <template v-else>
      <div class="me__bar">
        <span>按创建时间倒序 · 共 {{ total }} 枚</span>
        <CreateLink class="btn btn--primary btn--sm"><AppIcon name="plus" />新建胶囊</CreateLink>
      </div>
      <ul class="ledger">
        <li
          v-for="(c, i) in items"
          :key="c.id"
          class="ledger__row"
          :style="{ '--i': i }"
          data-testid="my-capsule"
          :data-code="c.code"
          :data-state="row(c).opened ? 'opened' : 'sealed'"
          :data-in-plaza="c.inPlaza"
        >
          <div class="ledger__seal">
            <PaperSeal :ch="row(c).opened ? '启' : '封'" :variant="row(c).opened ? 'line' : 'solid'" />
          </div>
          <div class="ledger__main">
            <NuxtLink class="ledger__title serif" :to="`/capsules/${c.code}`" data-testid="row-open">{{ c.title }}</NuxtLink>
            <div class="ledger__sub">
              <button class="ledger__code mono" type="button" title="点击复制胶囊码" @click="copy(c.code)">{{ c.code }}<AppIcon name="copy" /></button>
              <span v-if="c.inPlaza" class="tag"><AppIcon name="globe" />广场公开</span>
              <span v-else class="tag tag--quiet"><AppIcon name="lock" />仅凭码可见</span>
              <span>封存于 {{ fmt.date(row(c).createdAt) }}</span>
            </div>
          </div>
          <div v-if="row(c).opened" class="ledger__when">
            <span class="ledger__k">已启封</span>
            <b>{{ fmt.date(row(c).openAt) }}</b>
            <small>在途 {{ fmt.span(row(c).openAt - row(c).createdAt) }}</small>
          </div>
          <div v-else class="ledger__when">
            <span class="ledger__k">距启封</span>
            <b>
              <template v-if="row(c).cd.d > 0"><span class="latin">{{ fmt.num(row(c).cd.d) }}</span> 天</template>
              <span v-else class="mono">{{ pad2(row(c).cd.h) }}:{{ pad2(row(c).cd.m) }}:{{ pad2(row(c).cd.s) }}</span>
            </b>
            <PaperScale :p="fmt.progress(row(c).createdAt, row(c).openAt, now)" />
          </div>
          <div class="ledger__fav" :title="`被收藏 ${c.favoriteCount} 次`">
            <AppIcon name="heart" />
            <span class="latin">{{ fmt.num(c.favoriteCount) }}</span>
          </div>
          <div class="ledger__act">
            <NuxtLink class="btn btn--text" :to="`/capsules/${c.code}`">查看</NuxtLink>
            <button class="btn btn--text btn--danger" type="button" data-testid="delete-capsule" @click="remove(c, mark)">删除</button>
          </div>
        </li>
      </ul>
      <ListMore :show="hasMore" :busy="moreBusy" :left="total - items.length" @more="loadMore" />
      <p class="me__fine">
        <AppIcon name="info" />
        胶囊的内容与启封时刻一经封存就不可修改；你可以随时删除自己写的胶囊，无论它是否已经启封。
      </p>
    </template>
  </template>
  <ListStatus v-else :error="error" @retry="reload" />
</template>
