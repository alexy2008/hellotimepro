<!-- ============================================================
     「时笺」首页 = 胶囊广场（/）
     Hero（写一枚 + 逛广场 + 就地输码 + 此刻）+ 年鉴 + 工具条 + 信封卡片网格 + 分页
     结构与类名照 2.0 原型 paper/view-plaza.js
     ============================================================ -->
<script setup lang="ts">
import { computed } from "vue";
import { fmt } from "@/lib/fmt";
import { pageNumbers, scrollToPlaza, usePlazaHome } from "@/composables/usePlazaHome";
import AppIcon from "@/components/AppIcon.vue";
import CreateLink from "@/components/CreateLink.vue";
import SegControl from "@/components/SegControl.vue";
import type { PlazaFilter, PlazaSort } from "@/types";
import type { SegOption } from "@/components/seg";
import PaperAlmanacCell from "./PaperAlmanacCell.vue";
import PaperCard from "./PaperCard.vue";
import PaperCardSkeleton from "./PaperCardSkeleton.vue";
import PaperEmptyArt from "./PaperEmptyArt.vue";
import PaperHero from "./PaperHero.vue";

const { plaza, now, sort, filter, qInput, clearSearch, onSearchKey, rankOf, isMine } = usePlazaHome();

const sortOptions: SegOption<PlazaSort>[] = [
  { value: "new", label: "最新", icon: "clock" },
  { value: "hot", label: "最热", icon: "fire" },
];
const filterOptions = computed<SegOption<PlazaFilter>[]>(() => [
  { value: "all", label: "全部", count: plaza.counts?.all },
  { value: "unopened", label: "未开启", count: plaza.counts?.unopened },
  { value: "opened", label: "已开启", count: plaza.counts?.opened },
]);

const p = computed(() => plaza.pagination);
const term = computed(() => plaza.q.trim());
const goPage = (n: number) => {
  plaza.setPage(n);
  scrollToPlaza();
};
</script>

<template>
  <div class="page page--plaza">
    <PaperHero :now="now" :featured="plaza.featured" />

    <section class="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
      <template v-if="plaza.overview">
        <PaperAlmanacCell k="all" :n="plaza.overview.counts.all" a="枚胶囊" b="在广场上" />
        <PaperAlmanacCell k="unopened" :n="plaza.overview.counts.unopened" a="枚正在" b="等待启封" />
        <PaperAlmanacCell k="opened" :n="plaza.overview.counts.opened" a="枚已经" b="被人读到" />
        <PaperAlmanacCell
          v-if="plaza.overview.farthestOpenAt"
          k="farthestYear"
          :n="new Date(plaza.overview.farthestOpenAt).getFullYear()"
          a="年，最远的"
          b="一枚才会打开"
          plain
        />
      </template>
    </section>

    <section id="plaza" class="wrap plaza">
      <header class="plaza__head">
        <div>
          <div class="overline"><i />Plaza</div>
          <h2 class="h2">胶囊广场</h2>
        </div>
        <p class="plaza__sub">
          别人写给未来的话。
          <br />
          有的已经启封，有的还在路上。
        </p>
      </header>

      <div class="toolbar">
        <SegControl v-model="sort" label="排序" testid="sort-option" :options="sortOptions" />
        <SegControl v-model="filter" label="筛选" testid="filter-option" :options="filterOptions" />
        <label :class="['search', { 'has-value': qInput }]">
          <AppIcon name="search" />
          <input
            ref="plazaSearch"
            v-model="qInput"
            type="search"
            placeholder="搜索标题或昵称"
            maxlength="50"
            autocomplete="off"
            aria-label="搜索胶囊"
            data-testid="plaza-search"
            @keydown="onSearchKey"
          />
          <kbd>/</kbd>
          <button class="search__x" type="button" aria-label="清空搜索" @click="clearSearch"><AppIcon name="x" /></button>
        </label>
      </div>

      <div :class="['grid', { 'is-busy': plaza.loading && p }]" aria-live="polite">
        <template v-if="plaza.loading && !p">
          <PaperCardSkeleton v-for="i in 6" :key="i" :i="i - 1" />
        </template>
        <div v-else-if="plaza.error && !plaza.items.length" class="empty" data-testid="list-error">
          <PaperEmptyArt />
          <h3>广场暂时打不开</h3>
          <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
          <button class="btn btn--ghost" type="button" data-testid="list-retry" @click="plaza.refreshAll()">
            <AppIcon name="refresh" />
            重试
          </button>
        </div>
        <template v-else-if="!plaza.items.length && p">
          <div v-if="term" class="empty" data-testid="list-empty">
            <PaperEmptyArt />
            <h3>没有找到「{{ term }}」</h3>
            <p>换个关键词试试，标题和昵称都可以搜。</p>
            <button class="btn btn--ghost" type="button" @click="clearSearch">清空搜索</button>
          </div>
          <div v-else class="empty" data-testid="list-empty">
            <PaperEmptyArt />
            <h3>广场上还没有胶囊</h3>
            <p>来当第一个写信给未来的人？</p>
            <CreateLink class="btn btn--primary"><AppIcon name="pen" />写一枚胶囊</CreateLink>
          </div>
        </template>
        <template v-else>
          <PaperCard
            v-for="(c, i) in plaza.items"
            :key="c.id"
            :c="c"
            :i="i"
            :rank="rankOf(i)"
            :mine="isMine(c.creator.nickname)"
            :now="now"
          />
        </template>
      </div>

      <nav class="pager" aria-label="分页">
        <template v-if="p && plaza.items.length">
          <div v-if="p.totalPages <= 1" class="pager__sum">共 {{ fmt.num(p.total) }} 枚</div>
          <template v-else>
            <button class="pager__nav" type="button" :disabled="p.page <= 1" @click="goPage(p.page - 1)">
              <AppIcon name="chev-left" />
              上一页
            </button>
            <div class="pager__nums">
              <template v-for="(n, i) in pageNumbers(p.page, p.totalPages)" :key="n === '…' ? `g${i}` : n">
                <span v-if="n === '…'" class="pager__gap">…</span>
                <button
                  v-else
                  :class="['pager__n', 'latin', { 'is-active': n === p.page }]"
                  type="button"
                  :aria-current="n === p.page ? 'page' : undefined"
                  @click="goPage(n)"
                >
                  {{ n }}
                </button>
              </template>
            </div>
            <button
              class="pager__nav"
              type="button"
              :disabled="p.page >= p.totalPages"
              :data-testid="p.page < p.totalPages ? 'plaza-next' : undefined"
              @click="goPage(p.page + 1)"
            >
              下一页
              <AppIcon name="chev-right" />
            </button>
            <div class="pager__sum">共 {{ fmt.num(p.total) }} 枚 · 第 {{ p.page }} / {{ p.totalPages }} 页</div>
          </template>
        </template>
      </nav>
    </section>
  </div>
</template>
