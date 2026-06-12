<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/types";
import Alert from "@/components/Alert.vue";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const busy = ref(false);
const err = ref<string | null>(null);

async function submit() {
  err.value = null;
  busy.value = true;
  try {
    const tokens = await api.login({ email: email.value.trim(), password: password.value });
    auth.setTokens(tokens);
    const from = (route.query.from as string | undefined) ?? "/me/created";
    router.replace(from);
  } catch (e) {
    err.value = e instanceof ApiError ? e.message : "登录失败";
  } finally {
    busy.value = false;
  }
}

useHead({ title: "登录" });
</script>

<template>
  <main
    class="cy-container cy-container--narrow"
    style="margin-top: var(--space-12); margin-bottom: var(--space-16)"
  >
    <div class="cy-card" style="max-width: 440px; margin: 0 auto">
      <h1 style="font-family: var(--font-display); font-size: var(--font-size-3xl); margin: 0 0 var(--space-2)">
        欢迎回来
      </h1>
      <p style="color: var(--color-text-secondary); margin: 0 0 var(--space-8)">
        你留给未来的信，还在等你开启。
      </p>

      <form class="cy-form" @submit.prevent="submit">
        <div class="cy-field">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            class="cy-input"
            type="email"
            autocomplete="email"
            required
          />
        </div>
        <div class="cy-field">
          <label for="pwd">密码</label>
          <input
            id="pwd"
            v-model="password"
            class="cy-input"
            type="password"
            autocomplete="current-password"
            required
          />
          <span class="cy-field__hint">忘记密码？M1 暂不支持找回，请联系管理员重置。</span>
        </div>

        <button
          class="cy-btn cy-btn--primary cy-btn--lg"
          type="submit"
          style="width: 100%"
          :disabled="busy"
        >
          {{ busy ? "登录中…" : "登录" }}
        </button>

        <div
          style="text-align: center; color: var(--color-text-muted); font-size: var(--font-size-sm)"
        >
          还没有账号？
          <RouterLink to="/register" style="color: var(--color-brand-primary)">立即注册</RouterLink>
        </div>
      </form>
    </div>

    <div v-if="err" style="max-width: 440px; margin: var(--space-6) auto 0">
      <Alert variant="danger">{{ err }}</Alert>
    </div>
  </main>
</template>
