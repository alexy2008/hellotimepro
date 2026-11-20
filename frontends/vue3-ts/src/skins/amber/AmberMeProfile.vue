<!-- 「账号设置」：基本信息（昵称、星球头像）+ 修改密码 -->
<script setup lang="ts">
import { reactive } from "vue";
import { useAvatarIds, useProfile } from "@/composables/useAccount";
import AppIcon from "@/components/AppIcon.vue";
import AvatarPicker from "@/components/AvatarPicker.vue";
import FormField from "@/components/FormField.vue";
import FormMsg from "@/components/FormMsg.vue";
import NickState from "@/components/NickState.vue";
import PasswordField from "@/components/PasswordField.vue";
import PwdRules from "@/components/PwdRules.vue";

const emit = defineEmits<{ saved: [] }>();
const p = reactive(useProfile());
const ids = useAvatarIds();
const save = () => p.saveProfile().then(() => emit("saved"));
</script>

<template>
  <div class="profile">
    <section class="card card--pad">
      <div class="eyebrow">Profile</div>
      <h2 class="card__title">基本信息</h2>
      <form novalidate @submit.prevent="save">
        <FormField id="p-email" :model-value="p.user.email" label="邮箱" type="email" lead="mail" disabled hint="邮箱是登录账号，不可修改。" />
        <FormField
          id="p-nick"
          v-model="p.nickname"
          label="昵称"
          lead="user"
          :maxlength="20"
          autocomplete="nickname"
          :hint="p.nickHint ?? '2–20 个字符，全站唯一。'"
          :error="p.errors.nickname"
          test-id="profile-nickname"
        >
          <template #trail><NickState :state="p.nick" /></template>
        </FormField>
        <div class="field field--plain">
          <div class="field__head"><span class="field__label">头像</span></div>
          <AvatarPicker v-model="p.avatarId" :ids="ids" />
        </div>
        <FormMsg :m="p.msg" />
        <div class="card__act">
          <button class="btn btn--ghost" type="button" @click="p.resetProfile">重置</button>
          <button :class="['btn', 'btn--primary', { 'is-busy': p.busy }]" type="submit" :disabled="p.busy" data-testid="profile-save">
            <span>{{ p.busy ? "保存中…" : "保存更改" }}</span>
          </button>
        </div>
      </form>
    </section>
    <section class="card card--pad">
      <div class="eyebrow">Security</div>
      <h2 class="card__title">修改密码</h2>
      <form novalidate @submit.prevent="p.changePassword">
        <PasswordField id="pw-cur" v-model="p.pwd.current" label="当前密码" lead="lock" autocomplete="current-password" :error="p.errors.current" error-key="current" test-id="pwd-current" />
        <PasswordField id="pw-new" v-model="p.pwd.next" label="新密码" lead="key" autocomplete="new-password" :error="p.errors.next" error-key="new" test-id="pwd-new" />
        <PwdRules :value="p.pwd.next" />
        <PasswordField id="pw-again" v-model="p.pwd.confirm" label="再输一次新密码" lead="key" autocomplete="new-password" :error="p.errors.confirm" error-key="confirm" test-id="pwd-confirm" />
        <FormMsg :m="p.pwdMsg" />
        <p class="tip tip--quiet">
          <AppIcon name="shield" />
          <span>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</span>
        </p>
        <div class="card__act">
          <button :class="['btn', 'btn--primary', { 'is-busy': p.pwdBusy }]" type="submit" :disabled="p.pwdBusy" data-testid="pwd-submit">
            <span>{{ p.pwdBusy ? "更新中…" : "更新密码" }}</span>
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
