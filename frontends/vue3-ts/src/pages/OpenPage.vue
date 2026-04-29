<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import CapsuleCodeInput from "@/components/CapsuleCodeInput.vue";
import Alert from "@/components/Alert.vue";
import { api } from "@/api/client";
import { ApiError } from "@/types";

const router = useRouter();
const code = ref("");
const err = ref<string | null>(null);
const busy = ref(false);

async function open(c: string) {
  if (c.length !== 8) return;
  err.value = null;
  busy.value = true;
  try {
    const cap = await api.capsuleByCode(c);
    router.push(`/c/${cap.code}`);
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "找不到这条胶囊";
  } finally {
    busy.value = false;
  }
}

async function paste() {
  try {
    const text = await navigator.clipboard.readText();
    const filtered = text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    code.value = filtered;
    if (filtered.length === 8) void open(filtered);
  } catch {
    err.value = "粘贴失败：请允许浏览器访问剪贴板";
  }
}
</script>

<template>
  <main class="cy-container">
    <div class="cy-open-center">
      <h1>用 8 位密钥开启胶囊</h1>
      <p>输入朋友分享给你的 8 位大写字母和数字，可直接查看胶囊。</p>

      <div style="margin-bottom: var(--space-8)">
        <CapsuleCodeInput v-model="code" @complete="open" />
      </div>

      <div style="display:flex;gap:var(--space-3);justify-content:center;flex-wrap:wrap">
        <button
          class="cy-btn cy-btn--primary cy-btn--lg"
          :disabled="busy || code.length !== 8"
          @click="open(code)"
        >
          {{ busy ? "查询中…" : "开启 →" }}
        </button>
        <button class="cy-btn cy-btn--ghost cy-btn--lg" @click="paste">
          粘贴识别
        </button>
      </div>

      <div
        style="margin-top: var(--space-10); color: var(--color-text-muted); font-size: var(--font-size-sm)"
      >
        <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap">
          <span>
            💡 可用
            <code style="background: var(--color-surface-2); padding: 2px 6px; border-radius: var(--radius-sm)">/c/&lt;code&gt;</code>
            直链访问
          </span>
          <span>🔒 未到开启时间的胶囊也会显示倒计时</span>
        </div>
      </div>
    </div>

    <div v-if="err" style="max-width: 560px; margin: 0 auto">
      <Alert variant="danger">{{ err }}</Alert>
    </div>
  </main>
</template>
