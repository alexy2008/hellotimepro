<!-- ============================================================
     「时笺」胶囊详情（/capsules/:code）
     三种形态：未启封（信封 + 翻页倒计时 + 刻度尺）→ 启封动画 → 已启封（信笺）
     结构与类名照 2.0 原型 paper/view-capsule.js
     ============================================================ -->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { reducedMotion, sleep } from "@/lib/fmt";
import { toast } from "@/stores/feedback";
import { useCapsuleByCode } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import PaperDetailLetter from "./PaperDetailLetter.vue";
import PaperDetailSealed from "./PaperDetailSealed.vue";
import type { Opening } from "./art";
import PaperSeal from "./PaperSeal.vue";

const route = useRoute();
const code = computed(() => String(route.params.code ?? ""));
const { capsule, status, now, expired, awaitOpened } = useCapsuleByCode(code);

const opening = ref<Opening | null>(null);
const host = ref("");
const reveal = ref(false);
let started = false;
watch(code, () => (started = false)); // 换了一枚胶囊，重新等它到点

// 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影
watch(
  expired,
  async (v) => {
    if (!v || started) return;
    started = true;
    opening.value = { crack: "whole", open: false, rising: false };
    host.value = "is-opening";
    if (!reducedMotion()) {
      opening.value = { crack: "split", open: false, rising: false };
      await sleep(60);
      opening.value = { crack: "cracked", open: false, rising: false };
      await sleep(620);
      opening.value = { crack: "cracked", open: true, rising: false };
      await sleep(760);
      opening.value = { crack: "cracked", open: true, rising: true };
      await sleep(900);
      host.value = "is-opening is-leaving";
      await sleep(380);
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await awaitOpened())) return; // 离开了页面，或胶囊已被删除
    host.value = "";
    opening.value = null;
    reveal.value = true;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    toast("胶囊已启封");
  },
  { immediate: true },
);

const opened = computed(() => !!capsule.value && capsule.value.isOpened && !opening.value);
</script>

<template>
  <div class="page page--detail">
    <div
      :class="['wrap', 'wrap--narrow', 'detail', host]"
      :data-testid="capsule ? 'capsule-detail' : undefined"
      :data-code="capsule?.code"
      :data-state="capsule ? (opened ? 'opened' : 'sealed') : undefined"
      :data-in-plaza="capsule ? String(capsule.inPlaza) : undefined"
    >
      <div v-if="status === 'missing' || status === 'error'" class="lost" data-testid="detail-not-found">
        <div class="lost__mark"><PaperSeal ch="无" variant="line" /></div>
        <h1 class="h1">查无此信</h1>
        <p>
          <template v-if="code">没有找到胶囊码为 <b class="mono">{{ code.toUpperCase() }}</b> 的胶囊。</template>
          <template v-else>这枚胶囊不存在。</template>
          <br />
          它也可能已经被作者删除了。
        </p>
        <div class="lost__act">
          <RouterLink class="btn btn--primary" to="/open"><AppIcon name="key" />重新输入胶囊码</RouterLink>
          <RouterLink class="btn btn--ghost" to="/">回到广场</RouterLink>
        </div>
      </div>
      <template v-else-if="capsule">
        <PaperDetailLetter v-if="opened" :c="capsule" :reveal="reveal" />
        <PaperDetailSealed v-else :c="capsule" :now="now" :opening="opening" />
      </template>
    </div>
  </div>
</template>
