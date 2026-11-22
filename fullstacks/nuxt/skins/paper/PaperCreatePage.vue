<!-- ============================================================
     「时笺」创建页（/create）
     左：一张红格信笺（标题 · AI 灵感 · 正文）
     右：封缄台（时间标尺 + 日历 · 是否公开 · 信封预览 · 长按封缄）
     完成后：封缄仪式 → 取信凭证（8 位胶囊码）
     结构与类名照 2.0 原型 paper/view-create.js
     ============================================================ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { clamp, fmt, focusIfIdle, reducedMotion } from "@/lib/fmt";
import { DAY, LIMITS } from "@/lib/schedule";
import { useNow } from "@/composables/useNow";
import { useShake } from "@/composables/useMotion";
import { useCreateForm } from "@/composables/useCreateCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import PaperAvatarStamp from "./PaperAvatarStamp.vue";
import PaperCalendar from "./PaperCalendar.vue";
import PaperCeremony from "./PaperCeremony.vue";
import PaperHoldSeal from "./PaperHoldSeal.vue";
import PaperPostmark from "./PaperPostmark.vue";
import PaperTimeRuler from "./PaperTimeRuler.vue";

const PRESETS = [
  { key: "1m", label: "1 分钟后", sub: "体验启封" },
  { key: "tm", label: "明早 9 点" },
  { key: "1mo", label: "1 个月后" },
  { key: "1y", label: "1 年后" },
  { key: "5y", label: "5 年后" },
  { key: "10y", label: "10 年后" },
];

const auth = useAuthStore();
const me = computed(() => auth.user!);
const f = useCreateForm();
const now = useNow();
const calOpen = ref(false);
const titleEl = useTemplateRef<HTMLInputElement>("titleEl");
const contentEl = useTemplateRef<HTMLTextAreaElement>("contentEl");
const holdSeal = useTemplateRef<InstanceType<typeof PaperHoldSeal>>("holdSeal");
const titleShake = useShake(() => f.shake.title);
const contentShake = useShake(() => f.shake.content);
const openShake = useShake(() => f.shake.openAt);

const span = computed(() => f.draft.openAt - now.value);
const titleN = computed(() => Array.from(f.title).length);
const clampOpen = (t: number) => clamp(t, LIMITS.minOpen() + 30_000, LIMITS.maxOpen());

let focusTimer = 0;
onMounted(() => {
  focusTimer = window.setTimeout(() => focusIfIdle(titleEl.value), 420);
});
onBeforeUnmount(() => clearTimeout(focusTimer));

// 正文框随内容长高
const grow = () => {
  const el = contentEl.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.max(el.scrollHeight, 34 * 9) + "px";
};
onMounted(grow);
watch(() => f.content, grow, { flush: "post" });

// 校验失败：把出错的字段滚到眼前并聚焦
watch([() => f.shake.title, () => f.shake.content], () => {
  const el = f.errors.title ? titleEl.value : f.errors.content ? contentEl.value : null;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
});

async function onAgain() {
  f.again();
  holdSeal.value?.reset();
  await nextTick();
  titleEl.value?.focus({ preventScroll: true });
}
</script>

<template>
  <div class="page page--create">
    <div class="wrap create">
      <header class="pagehead">
        <div>
          <div class="overline"><i />New capsule</div>
          <h1 class="h1">写给未来的信</h1>
        </div>
        <p class="lede">
          这段文字会被封存，直到你设定的时刻，
          <br />
          才能被任何人——包括你自己——打开。
        </p>
      </header>

      <div class="create__grid">
        <!-- ============ 信笺 ============ -->
        <section :class="['sheet', { 'is-ai': f.aiBusy, 'is-thinking': f.aiThinking }]" aria-label="信的内容">
          <div class="sheet__head">
            <span class="sheet__to">致 未来 ——</span>
            <button
              :class="['aibtn', { 'is-busy': f.aiBusy }]"
              type="button"
              data-testid="ai-generate"
              title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题"
              @click="f.aiWrite()"
            >
              <AppIcon name="sparkle" />
              <span>{{ f.aiBusy ? "代笔中…" : f.aiDone ? "重新代笔" : "AI 代笔" }}</span>
            </button>
          </div>

          <div :class="['sheet__title', { 'is-shake': titleShake }]">
            <input
              ref="titleEl"
              v-model="f.title"
              type="text"
              maxlength="60"
              autocomplete="off"
              placeholder="给这封信起个标题"
              aria-label="标题，最多 60 字"
              data-testid="create-title"
            />
            <span class="sheet__n mono"><b>{{ titleN }}</b>/60</span>
          </div>
          <div class="sheet__err" role="alert" :data-testid="f.errors.title ? 'field-error' : undefined" data-field="title">{{ f.errors.title }}</div>

          <div :class="['recos', { 'is-hidden': !f.showRecos }]" :data-testid="f.showRecos ? 'ai-reco' : undefined">
            <div class="recos__in">
              <div class="recos__head">
                <span><AppIcon name="sparkle" />没有头绪？从一个灵感开始</span>
                <button class="linkbtn" type="button" data-testid="reco-refresh" :disabled="f.recoBusy || f.aiBusy" @click="f.refreshRecos()">
                  <AppIcon name="refresh" />
                  {{ f.recoBusy ? "换一批中…" : "换一批" }}
                </button>
              </div>
              <div class="recos__list">
                <button
                  v-for="(r, i) in f.recos"
                  :key="r.title"
                  class="reco"
                  type="button"
                  :style="{ '--i': i }"
                  data-testid="reco-chip"
                  :disabled="f.aiBusy"
                  @click="f.aiWrite(r.title)"
                >
                  <b>{{ r.title }}</b>
                  <span>{{ r.hint }}</span>
                  <em>{{ fmt.span(r.openInDays * DAY) }}后</em>
                </button>
              </div>
            </div>
          </div>

          <div :class="['sheet__body', { 'is-shake': contentShake }]">
            <textarea
              ref="contentEl"
              v-model="f.content"
              maxlength="5000"
              rows="9"
              aria-label="正文，最多 5000 字"
              :placeholder="'在这里写下想传到未来的话。\n可以是此刻的天气、正在读的书、一个小小的许诺，\n或者只是一句：嘿，你还好吗？'"
              data-testid="create-content"
            />
            <div class="sheet__think" aria-hidden="true"><i /><i /><i /></div>
          </div>
          <div class="sheet__err" role="alert" :data-testid="f.errors.content ? 'field-error' : undefined" data-field="content">{{ f.errors.content }}</div>

          <div class="sheet__foot">
            <span class="sheet__ainote">
              <template v-if="f.aiNote"><AppIcon name="sparkle" />{{ f.aiNote }}</template>
            </span>
            <span class="sheet__n mono"><b>{{ fmt.num(f.content.length) }}</b> / 5000</span>
          </div>

          <div class="sheet__sign">
            <span>——</span>
            <AppAvatar :id="me.avatarId" />
            <b>{{ me.nickname }}</b>
            <span class="sheet__date">{{ fmt.cn(now) }} {{ fmt.week(now) }}</span>
          </div>
        </section>

        <!-- ============ 封缄台 ============ -->
        <aside class="desk" aria-label="封缄设置">
          <section :class="['panel', { 'is-shake': openShake }]">
            <h2 class="panel__h"><span class="panel__no">壹</span>启封时刻</h2>

            <div class="presets">
              <button
                v-for="p in PRESETS"
                :key="p.key"
                :class="['chip', { 'is-active': f.draft.preset === p.key }]"
                type="button"
                data-testid="openat-preset"
                :data-value="p.key"
                :data-selected="f.draft.preset === p.key"
                @click="f.pickPreset(p.key)"
              >
                {{ p.label }}
                <small v-if="p.sub">{{ p.sub }}</small>
              </button>
            </div>

            <PaperTimeRuler :open-at="f.draft.openAt" :now="now" @pick="(t) => f.setOpenAt(t)" />

            <div class="when">
              <div class="when__rel serif">{{ fmt.span(span) }}后</div>
              <div class="when__abs" data-testid="create-openat" :data-value="new Date(f.draft.openAt).toISOString()">{{ fmt.full(f.draft.openAt) }}</div>
              <button :class="['linkbtn', 'when__more', { 'is-open': calOpen }]" type="button" :aria-expanded="calOpen" @click="calOpen = !calOpen">
                <AppIcon name="calendar" />
                <span>精确到分钟</span>
                <AppIcon name="chev-down" class="ic--chev" />
              </button>
            </div>
            <div class="sheet__err" role="alert" :data-testid="f.errors.openAt ? 'field-error' : undefined" data-field="openAt">{{ f.errors.openAt }}</div>

            <div :class="['calwrap', { 'is-open': calOpen }]">
              <div class="calwrap__in">
                <PaperCalendar v-if="calOpen" :open-at="f.draft.openAt" @pick="(t) => f.setOpenAt(clampOpen(t))" />
              </div>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__h"><span class="panel__no">贰</span>寄往广场</h2>
            <label class="switch">
              <input v-model="f.inPlaza" type="checkbox" data-testid="create-in-plaza" />
              <span class="switch__track"><i /></span>
              <span class="switch__text">
                <b>{{ f.inPlaza ? "发布到胶囊广场" : "只凭胶囊码可见" }}</b>
                <small>{{ f.inPlaza ? "所有人能看到标题与倒计时；正文在启封后公开。" : "不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。" }}</small>
              </span>
            </label>
          </section>

          <section class="panel panel--seal">
            <h2 class="panel__h"><span class="panel__no">叁</span>封缄</h2>
            <div :class="['envf', { 'is-private': !f.inPlaza }]" aria-hidden="true">
              <div class="envf__stamp"><PaperAvatarStamp :id="me.avatarId" class="stamp--sm" :label="false" /></div>
              <div class="envf__pm">
                <PaperPostmark :line1="fmt.date(f.draft.openAt)" :line2="`${fmt.time(f.draft.openAt)} 启`" class="pm--envf" />
              </div>
              <div class="envf__to">
                <small>寄往</small>
                <b>{{ fmt.cn(f.draft.openAt) }}</b>
                <span>{{ fmt.span(span) }}后的未来</span>
              </div>
              <div class="envf__title serif">{{ f.title.trim() ? `《${f.title.trim()}》` : "《未命名的信》" }}</div>
              <div class="envf__from mono">
                <span>自 {{ fmt.date(now) }} · {{ me.nickname }}</span>
                <span>{{ f.inPlaza ? "广场公开" : "仅凭码可见" }}</span>
              </div>
            </div>

            <PaperHoldSeal ref="holdSeal" :submitting="f.submitting" :validate="f.validate" :submit="f.submit" />
          </section>
        </aside>
      </div>
    </div>
    <PaperCeremony v-if="f.created" :c="f.created" @again="onAgain" />
  </div>
</template>
