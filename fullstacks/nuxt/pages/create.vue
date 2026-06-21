<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/client";
import { ApiError, type CapsuleRecommendation } from "@/types";
import Alert from "@/components/Alert.vue";
import RecommendationStrip from "@/components/RecommendationStrip.vue";
import { isoToLocalInput, localInputToIso } from "@/utils/format";

definePageMeta({ middleware: "auth-client" });
useHead({ title: "创建胶囊" });

const router = useRouter();

function presetTime(spec: "1m" | "1h" | "tomorrow9" | "1y" | "y2030"): string {
  const now = new Date();
  switch (spec) {
    case "1m":
      now.setSeconds(now.getSeconds() + 130);
      break;
    case "1h":
      now.setHours(now.getHours() + 1);
      break;
    case "tomorrow9":
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0);
      break;
    case "1y":
      now.setFullYear(now.getFullYear() + 1);
      break;
    case "y2030":
      return "2030-01-01T00:00";
  }
  return isoToLocalInput(now.toISOString());
}

const title = ref("");
const content = ref("");
const openLocal = ref(presetTime("1h"));
const inPlaza = ref(true);
const busy = ref(false);
const err = ref<string | null>(null);
const aiBusy = ref(false);
const aiInfo = ref<string | null>(null);
const aiGenerated = ref(false);

// AI 推荐主题：进入页面异步加载，拿到数据后才显示；失败则静默（不占位、不提示）
const recos = ref<CapsuleRecommendation[]>([]);
const recoBusy = ref(false);
let recoSeq = 0; // "换一批"竞态守卫

const contentLen = computed(() => content.value.length);

// 直接传入标题，避开 ref 更新时序（点击推荐时需要立刻用新标题生成）
async function runAiGenerate(rawTitle: string) {
  const t = rawTitle.trim();
  const autoTitle = !t;
  err.value = null;
  aiInfo.value = null;
  aiBusy.value = true;
  try {
    const s = await api.suggestCapsule({ title: t || undefined });
    content.value = s.content;
    openLocal.value = isoToLocalInput(s.openAt);
    aiGenerated.value = true;
    // 仅当本次是空标题模式、且当前标题仍为空时回填，避免覆盖用户已输入的字
    if (s.title && autoTitle && !title.value.trim()) {
      title.value = s.title;
    }
    const source = s.generatedBy === "local-template" ? "本地模板（LLM 未启用）" : s.generatedBy;
    const titleNote = s.title && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
    aiInfo.value = `${titleNote}，建议 ${s.openInDays} 天后开启 · 来源：${source}`;
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "AI 生成失败，请稍后重试";
  } finally {
    aiBusy.value = false;
  }
}

function aiGenerate() {
  void runAiGenerate(title.value);
}

async function loadRecos() {
  const seq = ++recoSeq;
  recoBusy.value = true;
  try {
    const list = await api.capsuleRecommendations({ count: 4 });
    if (seq !== recoSeq) return; // 丢弃过期响应
    // 空数组表示本次 LLM 不可用：保留已有推荐，不要把已显示的清空
    if (list.items.length > 0) recos.value = list.items;
  } catch {
    // 推荐是锦上添花：失败时静默
  } finally {
    if (seq === recoSeq) recoBusy.value = false;
  }
}

function pickReco(reco: CapsuleRecommendation) {
  title.value = reco.title;
  content.value = "";
  aiGenerated.value = false;
  void runAiGenerate(reco.title);
}

onMounted(() => {
  void loadRecos();
});

async function submit() {
  err.value = null;
  busy.value = true;
  try {
    const created = await api.createCapsule({
      title: title.value.trim(),
      content: content.value,
      openAt: localInputToIso(openLocal.value),
      inPlaza: inPlaza.value,
    });
    router.replace(`/c/${created.code}`);
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "创建失败";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main
    class="cy-container cy-container--narrow"
    style="margin-top: var(--space-10); margin-bottom: var(--space-16)"
  >
    <div style="max-width: 720px; margin: 0 auto">
      <h1 style="font-family: var(--font-display); font-size: var(--font-size-4xl); margin: 0 0 var(--space-2)">
        写给未来的信
      </h1>
      <p style="color: var(--color-text-secondary); margin: 0 0 var(--space-8)">
        这段文字会被上锁，直到你设定的时刻才能由任何人 —— 包括你自己 —— 开启。
      </p>

      <form class="cy-form" @submit.prevent="submit">
        <div class="cy-field">
          <label for="title">
            标题
            <span style="color: var(--color-text-muted); font-weight: 400">· 最多 60 字</span>
          </label>
          <div style="display:flex; gap: var(--space-2); align-items: stretch">
            <input
              id="title"
              v-model="title"
              class="cy-input"
              type="text"
              :maxlength="60"
              required
              style="flex: 1"
            />
            <button
              type="button"
              class="cy-btn cy-btn--ghost"
              :disabled="aiBusy"
              :title="'让 AI 生成胶囊正文与建议开启时间；标题留空时会顺便起个标题'"
              style="white-space: nowrap"
              @click="aiGenerate"
            >
              {{ aiBusy ? "生成中…" : aiGenerated ? "✨ 重新生成" : "✨ AI 生成" }}
            </button>
          </div>
          <span v-if="aiInfo" class="cy-field__hint" style="color: var(--color-text-secondary)">
            {{ aiInfo }}
          </span>
        </div>

        <RecommendationStrip
          v-if="!title.trim() && recos.length > 0"
          :recos="recos"
          :busy="recoBusy"
          :disabled="aiBusy"
          @pick="pickReco"
          @refresh="loadRecos"
        />

        <div class="cy-field">
          <label for="content">
            内容
            <span style="color: var(--color-text-muted); font-weight: 400">· 最多 5000 字</span>
          </label>
          <textarea
            id="content"
            v-model="content"
            class="cy-textarea"
            :rows="10"
            :maxlength="5000"
            required
            :placeholder="`在这里写下你想传递到未来的话。建议：\n- 具体的场景 / 情绪 / 正在读的书\n- 一个小小的许诺\n- 或只是一句：嘿，还活着吗？`"
          />
          <span class="cy-field__hint">
            <span style="color: var(--color-text-secondary)">{{ contentLen }}</span> / 5000
          </span>
        </div>

        <div class="cy-field">
          <label for="open_at">
            开启时间
            <span style="color: var(--color-text-muted); font-weight: 400">· 最早 60 秒后</span>
          </label>
          <DateTimePicker id="open_at" v-model="openLocal" />
          <span class="cy-field__hint">时区以你当前所在时区为准，提交时会转换为 UTC。</span>
          <div class="cy-create-presets">
            <span class="cy-create-presets__label">快速预设</span>
            <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="openLocal = presetTime('1m')">
              1 分钟后（测试）
            </button>
            <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="openLocal = presetTime('1h')">
              1 小时后
            </button>
            <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="openLocal = presetTime('tomorrow9')">
              明天早上 9:00
            </button>
            <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="openLocal = presetTime('1y')">
              1 年后
            </button>
            <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" @click="openLocal = presetTime('y2030')">
              2030.01.01
            </button>
          </div>
        </div>

        <Alert variant="info">
          上锁后不可编辑、不可提前开启；可以在"我创建的"列表里随时撤回（删除）。
        </Alert>

        <Alert v-if="err" variant="danger">{{ err }}</Alert>

        <div class="cy-create-actions">
          <label class="cy-toggle cy-toggle--inline">
            <input v-model="inPlaza" type="checkbox" />
            <span class="cy-toggle__track" />
            <span class="cy-toggle__label">发布到胶囊广场</span>
          </label>
          <div class="cy-create-actions__buttons">
            <button type="button" class="cy-btn cy-btn--ghost" @click="router.back()">
              取消
            </button>
            <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" :disabled="busy">
              {{ busy ? "封存中…" : "🔒 上锁封存" }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </main>
</template>
