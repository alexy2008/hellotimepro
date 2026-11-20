<!-- 「时笺」登录（/login）：结构与类名照 2.0 原型 paper/view-account.js -->
<script setup lang="ts">
import { useLogin, withRedirect } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import FormField from "@/components/FormField.vue";
import PasswordField from "@/components/PasswordField.vue";
import PaperAuthArt from "./PaperAuthArt.vue";

const { form, errors, busy, submit, onInput, redirect } = useLogin();
</script>

<template>
  <div class="page page--auth">
    <div class="auth">
      <PaperAuthArt :poem="['见字如面', '展信安好']" src="写信的人，在等回信的你" seal="信" />
      <section class="auth__main">
        <div class="auth__card">
          <div class="overline"><i />Sign in</div>
          <h1 class="h1">欢迎回来</h1>
          <p class="lede">你留给未来的信，还在等你开启。</p>
          <p v-if="redirect" class="note note--inline">
            <AppIcon name="info" />
            <span>登录后会带你回到刚才的页面。</span>
          </p>
          <form novalidate @submit.prevent="submit" @input="onInput">
            <FormField
              id="email"
              v-model="form.email"
              label="邮箱"
              type="email"
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
              autocomplete="current-password"
              placeholder="输入密码"
              hint="忘记密码？当前版本暂不支持找回。"
              :error="errors.password"
              test-id="login-password"
            />
            <div class="form__err" role="alert" :data-testid="errors.form ? 'login-error' : undefined">{{ errors.form }}</div>
            <button :class="['btn', 'btn--primary', 'btn--lg', 'btn--block', { 'is-busy': busy }]" type="submit" :disabled="busy" data-testid="login-submit">
              <span>{{ busy ? "登录中…" : "登录" }}</span>
              <AppIcon name="arrow" class="ic--go" />
            </button>
          </form>
          <p class="auth__alt">
            还没有账号？
            <RouterLink class="link" :to="withRedirect('/register', redirect)" data-testid="to-register">注册一个</RouterLink>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
