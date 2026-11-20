<!-- 「我创建的」：每行一枚专属配色的胶囊（含删除） -->
<script setup lang="ts">
import { h } from "vue";
import type { CapsuleListItem } from "@/types";
import { fmt, ms } from "@/lib/fmt";
import { paletteOf } from "@/lib/palette";
import { copyText } from "@/stores/feedback";
import { useMyList } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import CreateLink from "@/components/CreateLink.vue";
import ListMore from "@/components/ListMore.vue";
import AmberBadge from "./AmberBadge.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import AmberEmpty from "./AmberEmpty.vue";
import AmberVisBadge from "./AmberVisBadge.vue";
import { cdShort } from "./art";

const props = defineProps<{ now: number }>();
const emit = defineEmits<{ change: [] }>();
const { items, total, hasMore, moreBusy, loadMore, remove } = useMyList("created", () => emit("change"));

const row = (c: CapsuleListItem) => {
  const openAt = ms(c.openAt);
  const createdAt = ms(c.createdAt);
  return { openAt, createdAt, opened: c.isOpened || openAt <= props.now };
};
/** 删除确认框顶上放这枚胶囊的插画 */
const mark = (c: CapsuleListItem) => () =>
  h("div", { class: "dlg__art" }, h(AmberCapsuleArt, { code: c.code, state: "opened", width: 120 }));
const copy = (code: string) => copyText(code, `已复制胶囊码 ${code}`);
</script>

<template>
  <template v-if="items">
    <AmberEmpty v-if="!items.length" title="还没有写下任何胶囊" text="第一枚，写给一年后的自己怎么样？">
      <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
    </AmberEmpty>
    <template v-else>
      <div class="me__sub">
        <span>按创建时间倒序 · 共 {{ total }} 枚</span>
        <CreateLink class="btn btn--primary btn--sm"><AppIcon name="plus" />写一枚</CreateLink>
      </div>
      <ul class="ledger">
        <li
          v-for="(c, i) in items"
          :key="c.id"
          class="ledger__row"
          :style="{ '--i': i, '--glow': paletteOf(c.code).glow }"
          data-testid="my-capsule"
          :data-code="c.code"
          :data-state="row(c).opened ? 'opened' : 'sealed'"
          :data-in-plaza="c.inPlaza"
        >
          <RouterLink class="ledger__art" :to="`/capsules/${c.code}`" tabindex="-1" aria-hidden="true">
            <AmberCapsuleArt :code="c.code" :state="row(c).opened ? 'opened' : 'locked'" :width="112" />
          </RouterLink>
          <div class="ledger__main">
            <RouterLink class="ledger__title" :to="`/capsules/${c.code}`" data-testid="row-open">{{ c.title }}</RouterLink>
            <div class="ledger__sub">
              <button class="ledger__code mono" type="button" title="点击复制胶囊码" @click="copy(c.code)">{{ c.code }}<AppIcon name="copy" /></button>
              <AmberVisBadge :in-plaza="c.inPlaza" />
              <span>封存于 {{ fmt.date(row(c).createdAt) }}</span>
            </div>
          </div>
          <div class="ledger__when">
            <template v-if="row(c).opened">
              <AmberBadge kind="opened" icon="mail">已开启</AmberBadge>
              <span>{{ fmt.date(row(c).openAt) }} · 沉睡 {{ fmt.span(row(c).openAt - row(c).createdAt) }}</span>
            </template>
            <template v-else>
              <span class="ledger__cd"><AppIcon name="hourglass" /><b class="mono">{{ cdShort(row(c).openAt, now) }}</b></span>
              <div class="pc__progress">
                <span :style="{ width: `${Math.max(2, fmt.progress(row(c).createdAt, row(c).openAt, now))}%` }" />
              </div>
            </template>
          </div>
          <div class="ledger__fav" :title="`被收藏 ${c.favoriteCount} 次`">
            <AppIcon name="heart" />
            <span class="mono">{{ fmt.num(c.favoriteCount) }}</span>
          </div>
          <div class="ledger__act">
            <RouterLink class="btn btn--ghost btn--sm" :to="`/capsules/${c.code}`">查看</RouterLink>
            <button class="btn btn--danger-ghost btn--sm" type="button" data-testid="delete-capsule" @click="remove(c, mark(c))">删除</button>
          </div>
        </li>
      </ul>
      <ListMore :show="hasMore" :busy="moreBusy" :left="total - items.length" @more="loadMore" />
      <p class="tip tip--quiet">
        <AppIcon name="info" />
        <span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span>
      </p>
    </template>
  </template>
</template>
