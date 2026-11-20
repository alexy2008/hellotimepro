<!-- 「时笺」注册（/register）：挑一枚邮票当头像 -->
<script setup lang="ts">
import { useAvatarIds, useRegister, withRedirect } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import AvatarPicker from "@/components/AvatarPicker.vue";
import FormField from "@/components/FormField.vue";
import NickState from "@/components/NickState.vue";
import PasswordField from "@/components/PasswordField.vue";
import PwdRules from "@/components/PwdRules.vue";
import PaperAuthArt from "./PaperAuthArt.vue";

const { form, nick, errors, busy, submit, redirect } = useRegister();
const ids = useAvatarIds();
</script>

<template>
  <div class="page page--auth">
    <div class="auth">
      <PaperAuthArt :poem="['纸短情长', '来日方长']" src="先留个名字，再慢慢写" seal="缄" />
      <section class="auth__main">
        <div class="auth__card auth__card--wide">
          <div class="overline"><i />Sign up</div>
          <h1 class="h1">领一个信箱</h1>
          <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
          <form novalidate @submit.prevent="submit">
            <div class="form__row">
              <FormField
                id="email"
                v-model="form.email"
                label="邮箱"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                hint="作为登录账号，注册后不可修改。"
                :error="errors.email"
                test-id="register-email"
                autofocus
              />
              <FormField
                id="nickname"
                v-model="form.nickname"
                label="昵称"
                :maxlength="20"
                autocomplete="nickname"
                placeholder="2–20 个字符"
                :hint="nick.hint ?? '全站唯一，注册后可以改。'"
                :error="errors.nickname ?? (nick.state === 'invalid' ? nick.hint : undefined)"
                test-id="register-nickname"
              >
                <template #trail><NickState :state="errors.nickname ? 'taken' : nick.state" /></template>
              </FormField>
            </div>
            <PasswordField
              id="password"
              v-model="form.password"
              label="密码"
              autocomplete="new-password"
              placeholder="设置密码"
              :error="errors.password"
              test-id="register-password"
            />
            <PwdRules :value="form.password" />
            <div class="field field--plain">
              <span class="field__label">邮票头像 <small>十选一，不支持上传</small></span>
              <AvatarPicker v-model="form.avatarId" :ids="ids" />
            </div>
            <div class="form__err" role="alert">{{ errors.form ?? errors.avatarId }}</div>
            <button :class="['btn', 'btn--primary', 'btn--lg', 'btn--block', { 'is-busy': busy }]" type="submit" :disabled="busy" data-testid="register-submit">
              <span>{{ busy ? "正在创建…" : "创建账号，开始写信" }}</span>
              <AppIcon name="arrow" class="ic--go" />
            </button>
          </form>
          <p class="auth__alt">
            已经有账号？
            <RouterLink class="link" :to="withRedirect('/login', redirect)" data-testid="to-login">去登录</RouterLink>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
