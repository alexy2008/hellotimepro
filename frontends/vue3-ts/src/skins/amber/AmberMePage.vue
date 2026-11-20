<!-- ============================================================
     「琥珀」我的（/me/created · /me/favorites · /me/profile）
     页签是一枚大号分段控件，每一项是链接，滑块跟着当前页签
     结构与类名照 2.0 原型 amber/view-account.js
     ============================================================ -->
<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/feedback";
import { fmt, ms } from "@/lib/fmt";
import type { IconName } from "@/lib/icons";
import { useNow } from "@/composables/useNow";
import { useSlider } from "@/composables/useMotion";
import { useMyStats } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import AmberMeCreated from "./AmberMeCreated.vue";
import AmberMeFavorites from "./AmberMeFavorites.vue";
import AmberMeProfile from "./AmberMeProfile.vue";

const auth = useAuthStore();
const user = computed(() => auth.user!);
const route = useRoute();
const router = useRouter();
const tab = computed(() => String(route.params.tab));
const now = useNow();
const { stats, refresh } = useMyStats();

const box = useTemplateRef<HTMLElement>("box");
const thumb = useSlider(box, ".seg__opt.is-active", [tab, () => stats.value?.created, () => stats.value?.favoritesGiven]);

const STATS = [
  ["created", "写下的胶囊"],
  ["unopened", "还在封存中"],
  ["favoritesReceived", "被收藏的次数"],
] as const;
const tabs = computed<Array<{ key: string; icon: IconName; label: string; n?: number }>>(() => [
  { key: "created", icon: "feather", label: "我创建的", n: stats.value?.created },
  { key: "favorites", icon: "heart", label: "我收藏的", n: stats.value?.favoritesGiven },
  { key: "profile", icon: "sliders", label: "账号设置" },
]);

async function logout() {
  await auth.logout(true);
  toast("已登出");
  await router.push("/");
}
</script>

<template>
  <div class="page page--me">
    <div class="container me">
      <header class="me__head card">
        <div class="me__id">
          <div class="me__orb">
            <AppAvatar :id="user.avatarId" class="av--hero" />
            <span class="me__ring" />
          </div>
          <div>
            <div class="eyebrow">My capsules</div>
            <h1 class="page-title">{{ user.nickname }}</h1>
            <p class="me__mail">
              <span class="mono">{{ user.email }}</span>
              <span>{{ fmt.cn(ms(user.createdAt)) }} 加入</span>
            </p>
          </div>
        </div>
        <dl class="me__stats">
          <div v-for="[k, label] in STATS" :key="k" data-testid="me-stat" :data-key="k" :data-value="stats?.[k] ?? ''">
            <dd class="mono">{{ stats ? fmt.num(stats[k]) : "—" }}</dd>
            <dt>{{ label }}</dt>
          </div>
        </dl>
      </header>

      <div class="me__bar">
        <nav ref="box" class="seg seg--lg" aria-label="我的">
          <span class="seg__thumb" :style="thumb" />
          <RouterLink
            v-for="t in tabs"
            :key="t.key"
            :class="['seg__opt', { 'is-active': tab === t.key }]"
            :to="`/me/${t.key}`"
            :aria-current="tab === t.key ? 'page' : undefined"
            :data-testid="`me-tab-${t.key}`"
            :data-count="t.n"
          >
            <AppIcon :name="t.icon" />{{ t.label }}<sup v-if="t.n != null">{{ t.n }}</sup>
          </RouterLink>
        </nav>
        <button class="btn btn--ghost btn--sm" type="button" @click="logout"><AppIcon name="logout" />登出</button>
      </div>

      <div :key="route.path" class="me__body is-swap" :data-tab="tab">
        <AmberMeCreated v-if="tab === 'created'" :now="now" @change="refresh" />
        <AmberMeFavorites v-else-if="tab === 'favorites'" :now="now" @change="refresh" />
        <AmberMeProfile v-else @saved="refresh" />
      </div>
    </div>
  </div>
</template>
