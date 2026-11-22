<!-- 「琥珀」登录（/login）：结构与类名照 2.0 原型 amber/view-account.js -->
<script setup lang="ts">
import { useLogin, withRedirect } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import FormField from "@/components/FormField.vue";
import PasswordField from "@/components/PasswordField.vue";
import AmberAuthArt from "./AmberAuthArt.vue";

const { form, errors, busy, submit, onInput, redirect } = useLogin();
</script>

<template>
  <div class="page page--auth">
    <div class="container auth">
      <div class="auth__card card">
        <AmberAuthArt state="locked" />
        <div class="eyebrow eyebrow--center">Welcome back</div>
        <h1 class="page-title">欢迎回来</h1>
        <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
        <p v-if="redirect" class="tip">
          <AppIcon name="info" />
          <span>登录后会带你回到刚才的页面。</span>
        </p>
        <form novalidate @submit.prevent="submit" @input="onInput">
          <FormField
            id="email"
            v-model="form.email"
            label="邮箱"
            type="email"
            lead="mail"
            autocomplete="email"
            placeholder="you@example.com"
            :error="errors.email"
            test-id="login-email"
            autofocus
          />
          <PasswordField
            id="password"
            v-model="form.password"
            label="密码"
            lead="lock"
            autocomplete="current-password"
            placeholder="输入密码"
            hint="忘记密码？当前版本暂不支持找回。"
            :error="errors.password"
            test-id="login-password"
          />
          <div class="form__err" role="alert" :data-testid="errors.form ? 'login-error' : undefined">{{ errors.form }}</div>
          <button :class="['btn', 'btn--primary', 'btn--lg', 'btn--block', { 'is-busy': busy }]" type="submit" :disabled="busy" data-testid="login-submit">
            <span>{{ busy ? "登录中…" : "登录" }}</span>
            <AppIcon name="arrow" />
          </button>
        </form>
        <p class="auth__alt">
          还没有账号？
          <NuxtLink :to="withRedirect('/register', redirect)" data-testid="to-register">注册一个</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
