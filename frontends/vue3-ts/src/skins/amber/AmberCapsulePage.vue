<!-- ============================================================
     「琥珀」胶囊详情（/capsules/:code）
     一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
     结构与类名照 2.0 原型 amber/view-capsule.js
     ============================================================ -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { reducedMotion, sleep } from "@/lib/fmt";
import { toast } from "@/stores/feedback";
import { useCapsuleByCode } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import AmberDetailLetter from "./AmberDetailLetter.vue";
import AmberDetailLocked from "./AmberDetailLocked.vue";

const route = useRoute();
const code = computed(() => String(route.params.code ?? ""));
const { capsule, status, now, expired, awaitOpened } = useCapsuleByCode(code);

const phase = ref<"" | "shaking" | "open">("");
const reveal = ref(false);
let started = false;
watch(code, () => (started = false)); // 换了一枚胶囊，重新等它到点

// 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上
watch(
  expired,
  async (v) => {
    if (!v || started) return;
    started = true;
    if (!reducedMotion()) {
      phase.value = "shaking";
      window.scrollTo({ top: 0, behavior: "smooth" });
      await sleep(820);
      phase.value = "open";
      await sleep(1150);
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await awaitOpened())) return; // 离开了页面，或胶囊已被删除
    phase.value = "";
    reveal.value = true;
    toast("胶囊已开启");
  },
  { immediate: true },
);

const opened = computed(() => !!capsule.value && capsule.value.isOpened && !phase.value);
</script>

<template>
  <div class="page page--detail">
    <div
      class="container detail"
      :data-testid="capsule ? 'capsule-detail' : undefined"
      :data-code="capsule?.code"
      :data-state="capsule ? (opened ? 'opened' : 'sealed') : undefined"
      :data-in-plaza="capsule ? String(capsule.inPlaza) : undefined"
    >
      <div v-if="status === 'missing' || status === 'error'" class="notice card" data-testid="detail-not-found">
        <AmberCapsuleArt code="LOST0000" state="opened" :width="200" class="notice__art" />
        <div class="eyebrow">Not found</div>
        <h1 class="page-title">找不到这枚胶囊</h1>
        <p class="page-lead">
          <template v-if="code">没有胶囊码为 <b class="mono">{{ code.toUpperCase() }}</b> 的胶囊。</template>
          <template v-else>这枚胶囊不存在。</template>
          也许是码抄错了一位，也许它已经被作者删除了。
        </p>
        <div class="notice__act">
          <RouterLink class="btn btn--primary" to="/open"><AppIcon name="key" />重新输入胶囊码</RouterLink>
          <RouterLink class="btn btn--ghost" to="/">回到广场</RouterLink>
        </div>
      </div>
      <template v-else-if="capsule">
        <div v-if="phase" :class="['opening', { 'is-open': phase === 'open' }]">
          <div class="opening__burst" />
          <div class="opening__capsule">
            <AmberCapsuleArt :code="capsule.code" :state="phase === 'open' ? 'opened' : 'locked'" :width="300" />
          </div>
          <p class="opening__text">时间到了，正在开启……</p>
        </div>
        <AmberDetailLetter v-else-if="opened" :c="capsule" :reveal="reveal" />
        <AmberDetailLocked v-else :c="capsule" :now="now" />
      </template>
    </div>
  </div>
</template>
