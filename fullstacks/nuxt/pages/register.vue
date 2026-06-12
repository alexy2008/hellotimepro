<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import AvatarPicker from "@/components/AvatarPicker.vue";
import Alert from "@/components/Alert.vue";

const router = useRouter();
const auth = useAuthStore();

const avatars = ref<Avatar[]>([]);
const email = ref("");
const nickname = ref("");
const password = ref("");
const avatarId = ref<string | null>(null);
const busy = ref(false);
const err = ref<string | null>(null);

onMounted(async () => {
  try {
    const list = await api.avatars();
    avatars.value = list;
    if (list.length > 0) avatarId.value = list[0].id;
  } catch {
    err.value = "拉取头像列表失败，请检查后端是否已启动";
  }
});

async function submit() {
  err.value = null;
  if (!avatarId.value) {
    err.value = "请选择一个头像";
    return;
  }
  busy.value = true;
  try {
    const tokens = await api.register({
      email: email.value.trim(),
      password: password.value,
      nickname: nickname.value.trim(),
      avatarId: avatarId.value,
    });
    auth.setTokens(tokens);
    router.replace("/create");
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "注册失败";
  } finally {
    busy.value = false;
  }
}

useHead({ title: "注册" });
</script>

<template>
  <main
    class="cy-container cy-container--narrow"
    style="margin-top: var(--space-12); margin-bottom: var(--space-16)"
  >
    <div class="cy-card" style="max-width: 560px; margin: 0 auto">
      <h1 style="font-family: var(--font-display); font-size: var(--font-size-3xl); margin: 0 0 var(--space-2)">
        注册新身份
      </h1>
      <p style="color: var(--color-text-secondary); margin: 0 0 var(--space-8)">
        选一个赛博头像、写一封最早 60 秒后才能打开的信。
      </p>

      <form class="cy-form" @submit.prevent="submit">
        <div class="cy-field">
          <label for="email">邮箱</label>
          <input id="email" v-model="email" class="cy-input" type="email" required />
        </div>
        <div class="cy-field">
          <label for="nick">昵称</label>
          <input id="nick" v-model="nickname" class="cy-input" type="text" :maxlength="20" required />
          <span class="cy-field__hint">2–20 字符，注册后可修改。</span>
        </div>
        <div class="cy-field">
          <label for="pwd">密码</label>
          <input id="pwd" v-model="password" class="cy-input" type="password" required :minlength="8" />
          <span class="cy-field__hint">至少 8 位，需包含字母和数字。</span>
        </div>
        <div class="cy-field">
          <label>选择头像（必选）</label>
          <AvatarPicker v-model="avatarId" :avatars="avatars" />
          <span class="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
        </div>
        <button
          class="cy-btn cy-btn--primary cy-btn--lg"
          type="submit"
          style="width: 100%"
          :disabled="busy"
        >
          {{ busy ? "提交中…" : "创建账号并进入创建胶囊" }}
        </button>
        <div
          style="text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm)"
        >
          已有账号？
          <RouterLink to="/login" style="color: var(--color-brand-primary)">去登录</RouterLink>
        </div>
      </form>
    </div>

    <div v-if="err" style="max-width: 560px; margin: var(--space-6) auto 0">
      <Alert variant="danger">{{ err }}</Alert>
    </div>
  </main>
</template>
