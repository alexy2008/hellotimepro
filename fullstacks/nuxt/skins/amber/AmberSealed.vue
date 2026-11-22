<!-- 封存完成：胶囊合拢，8 位码牌逐个翻出 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, reducedMotion } from "@/lib/fmt";
import { paletteOf } from "@/lib/palette";
import { useShare } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import AmberVisBadge from "./AmberVisBadge.vue";
import { dash } from "./art";

const props = defineProps<{ c: CapsuleDetail }>();
defineEmits<{ again: [] }>();

const { copyCode, copyLink } = useShare(() => props.c.code);
const openAt = computed(() => new Date(props.c.openAt).getTime());
const inn = ref(false);
let raf = 0;
onMounted(() => {
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
  raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => (inn.value = true))));
});
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>

<template>
  <section :class="['sealed', 'card', { 'is-in': inn }]" :style="{ '--glow': paletteOf(c.code).glow }" data-testid="sealed-receipt" :data-code="c.code">
    <div class="sealed__art"><AmberCapsuleArt :code="c.code" :state="inn ? 'locked' : 'opened'" :width="260" /></div>
    <div class="eyebrow eyebrow--center">Sealed</div>
    <h1 class="page-title">胶囊已封存</h1>
    <p class="page-lead">下面这串胶囊码是开启它的钥匙，{{ c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。" }}</p>
    <div class="tiles mono" :aria-label="`胶囊码 ${c.code}`" data-testid="sealed-code">
      <span v-for="(ch, i) in Array.from(c.code)" :key="i" :class="['tile', { 'has-gap': i === 4 }]" :style="{ '--i': i }">{{ ch }}</span>
    </div>
    <div class="sealed__act">
      <button class="btn btn--primary" type="button" data-testid="copy-code" @click="copyCode"><AppIcon name="copy" />复制胶囊码</button>
      <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink"><AppIcon name="link" />复制开启链接</button>
    </div>
    <dl class="sealed__meta">
      <div>
        <dt>标题</dt>
        <dd>{{ c.title }}</dd>
      </div>
      <div>
        <dt>开启时间</dt>
        <dd class="mono">{{ dash(openAt) }}</dd>
      </div>
      <div>
        <dt>沉睡时长</dt>
        <dd>{{ fmt.span(openAt - Date.now()) }}</dd>
      </div>
      <div>
        <dt>属性</dt>
        <dd><AmberVisBadge :in-plaza="c.inPlaza" /></dd>
      </div>
    </dl>
    <div class="sealed__links">
      <NuxtLink class="link-btn" :to="`/capsules/${c.code}`" data-testid="receipt-view">看看它的倒计时<AppIcon name="arrow" /></NuxtLink>
      <button class="link-btn" type="button" data-testid="receipt-again" @click="$emit('again')">再写一枚<AppIcon name="plus" /></button>
      <NuxtLink class="link-btn" to="/me/created">我创建的<AppIcon name="feather" /></NuxtLink>
    </div>
  </section>
</template>
