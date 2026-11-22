<!-- ============================================================
     「时笺」我的（/me/created · /me/favorites · /me/profile）
     三个页签共用这一个组件（同一条路由、参数不同），切页签时页头与统计不重新挂载
     结构与类名照 2.0 原型 paper/view-account.js
     ============================================================ -->
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/feedback";
import { fmt, ms } from "@/lib/fmt";
import { useNow } from "@/composables/useNow";
import { useSlider } from "@/composables/useMotion";
import { useMyStats } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import PaperAvatarStamp from "./PaperAvatarStamp.vue";
import PaperMeCreated from "./PaperMeCreated.vue";
import PaperMeFavorites from "./PaperMeFavorites.vue";
import PaperMeProfile from "./PaperMeProfile.vue";

const auth = useAuthStore();
const user = computed(() => auth.user!);
const route = useRoute();
const router = useRouter();
const tab = computed(() => String(route.params.tab));
const now = useNow();
const { stats, refresh } = useMyStats();

// 页签下的墨线：跟着当前页签滑过去
const nav = useTemplateRef<HTMLElement>("nav");
const ink = useSlider(nav, ".tabs__it.is-active", [tab, stats]);

const STATS = [
  ["created", "写下的胶囊"],
  ["unopened", "还在等待启封"],
  ["favoritesReceived", "被收藏的次数"],
] as const;
const tabs = computed(() => [
  { key: "created", label: "我创建的", n: stats.value?.created },
  { key: "favorites", label: "我收藏的", n: stats.value?.favoritesGiven },
  { key: "profile", label: "账号设置", n: undefined },
]);

async function logout() {
  await auth.logout(true);
  toast("已登出");
  await router.push("/");
}
</script>

<template>
  <div class="page page--me">
    <div class="wrap me">
      <header class="me__head">
        <div class="me__id">
          <PaperAvatarStamp :id="user.avatarId" class="stamp--lg" />
          <div>
            <div class="overline"><i />My desk</div>
            <h1 class="h1">{{ user.nickname }}</h1>
            <p class="me__mail">
              <span class="mono">{{ user.email }}</span>
              <span>{{ fmt.cn(ms(user.createdAt)) }} 加入</span>
            </p>
          </div>
        </div>
        <dl class="me__stats">
          <div v-for="[k, label] in STATS" :key="k" data-testid="me-stat" :data-key="k" :data-value="stats?.[k] ?? ''">
            <dd class="latin">{{ stats ? fmt.num(stats[k]) : "—" }}</dd>
            <dt>{{ label }}</dt>
          </div>
        </dl>
      </header>

      <nav ref="nav" class="tabs" aria-label="我的">
        <NuxtLink
          v-for="t in tabs"
          :key="t.key"
          :class="['tabs__it', { 'is-active': tab === t.key }]"
          :to="`/me/${t.key}`"
          :aria-current="tab === t.key ? 'page' : undefined"
          :data-testid="`me-tab-${t.key}`"
          :data-count="t.n"
        >
          {{ t.label }}<sup v-if="t.n != null">{{ t.n }}</sup>
        </NuxtLink>
        <span class="tabs__ink" aria-hidden="true" :style="ink" />
        <button class="linkbtn tabs__out" type="button" @click="logout"><AppIcon name="logout" />登出</button>
      </nav>

      <div :key="route.path" class="me__body is-swap" :data-tab="tab">
        <PaperMeCreated v-if="tab === 'created'" :now="now" @change="refresh" />
        <PaperMeFavorites v-else-if="tab === 'favorites'" :now="now" @change="refresh" />
        <PaperMeProfile v-else @saved="refresh" />
      </div>
    </div>
  </div>
</template>
