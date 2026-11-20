<!-- ============================================================
     封缄仪式 → 取信凭证：信纸落进信封 → 封舌合上 → 火漆落下 → 凭证滑出。
     整层盖在页面之上，用 <Teleport> 挂到 body。
     ============================================================ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";
import type { CapsuleDetail } from "@/types";
import { fmt, reducedMotion, sleep } from "@/lib/fmt";
import { useShare } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import PaperEnvelope from "./PaperEnvelope.vue";

const props = defineProps<{ c: CapsuleDetail }>();
defineEmits<{ again: [] }>();

const { copyCode, copyLink } = useShare(() => props.c.code);
const openAt = computed(() => new Date(props.c.openAt).getTime());
const cls = ref("");
const env = ref("is-open is-rising");
const first = useTemplateRef<HTMLButtonElement>("first");
let alive = true;

onMounted(async () => {
  const q = reducedMotion();
  await sleep(30);
  if (!alive) return;
  cls.value = "is-in";
  await sleep(q ? 0 : 520);
  env.value = "is-open"; // 信纸落进信封
  await sleep(q ? 0 : 760);
  env.value = ""; // 封舌合上
  await sleep(q ? 0 : 780);
  cls.value = "is-in is-stamped"; // 火漆落下
  await sleep(q ? 0 : 720);
  if (!alive) return;
  cls.value = "is-in is-stamped is-done"; // 凭证滑出
  first.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => (alive = false));
</script>

<template>
  <Teleport to="body">
    <div :class="['cer', cls]" role="dialog" aria-modal="true" aria-label="封缄完成" data-testid="sealed-receipt" :data-code="c.code">
      <div class="cer__bg" />
      <div class="cer__in">
        <div class="cer__stage">
          <PaperEnvelope :class="['env--cer', env]"><b>{{ c.title }}</b><i /><i /><i /><i /></PaperEnvelope>
        </div>
        <div class="rcpt">
          <div class="rcpt__k">
            <span>封缄完成</span>
            <i />
            <span class="latin">Sealed</span>
          </div>
          <h2 class="rcpt__t serif">《{{ c.title }}》</h2>
          <p class="rcpt__w">
            将于 <b>{{ fmt.full(openAt) }}</b> 启封
            <br />
            还要等 {{ fmt.span(openAt - Date.now()) }}
          </p>
          <div class="rcpt__code mono" :aria-label="`胶囊码 ${c.code}`" data-testid="sealed-code">
            <template v-for="(ch, i) in Array.from(c.code)" :key="i">
              <span :style="{ '--i': i }">{{ ch }}</span>
              <i v-if="i === 3" />
            </template>
          </div>
          <p class="rcpt__hint">
            这 8 位胶囊码是开启它的凭证。{{ c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。" }}
          </p>
          <div class="rcpt__act">
            <button ref="first" class="btn btn--primary" type="button" data-testid="copy-code" @click="copyCode"><AppIcon name="copy" />复制胶囊码</button>
            <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink"><AppIcon name="link" />复制分享链接</button>
          </div>
          <div class="rcpt__more">
            <RouterLink :to="`/capsules/${c.code}`" data-testid="receipt-view">查看这枚胶囊<AppIcon name="arrow" /></RouterLink>
            <button class="linkbtn" type="button" data-testid="receipt-again" @click="$emit('again')"><AppIcon name="pen" />再写一枚</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
