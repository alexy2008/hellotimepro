<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { api } from "@/api/client";
import { ApiError, type CapsuleDetail as CapsuleDetailT } from "@/types";
import CapsuleDetail from "@/components/CapsuleDetail.vue";
import Alert from "@/components/Alert.vue";

const route = useRoute();
const cap = ref<CapsuleDetailT | null>(null);
const err = ref<string | null>(null);
const loading = ref(true);

async function loadCapsule({ showLoading = true } = {}) {
  if (showLoading) loading.value = true;
  err.value = null;
  const code = String(route.params.code ?? "").toUpperCase();
  try {
    const c = await api.capsuleByCode(code);
    cap.value = c;
    return c;
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "胶囊不存在";
    return null;
  } finally {
    if (showLoading) loading.value = false;
  }
}

watch(
  () => route.params.code,
  () => {
    void loadCapsule();
  },
  { immediate: true },
);

function onChange(c: CapsuleDetailT) {
  cap.value = c;
}
</script>

<template>
  <main class="cy-container">
    <div v-if="loading" class="cy-empty"><p>加载中…</p></div>
    <CapsuleDetail
      v-else-if="cap"
      :capsule="cap"
      @change="onChange"
      @expired="loadCapsule({ showLoading: false })"
    />
    <div v-else style="max-width: 560px; margin: var(--space-12) auto">
      <Alert variant="danger">{{ err ?? "胶囊不存在" }}</Alert>
      <div style="margin-top: var(--space-4); text-align: center">
        <RouterLink class="cy-btn cy-btn--ghost" to="/open">返回输入码</RouterLink>
      </div>
    </div>
  </main>
</template>
