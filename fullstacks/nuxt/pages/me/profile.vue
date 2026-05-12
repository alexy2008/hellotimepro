<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { ApiError, type Avatar } from "@/types";
import AvatarPicker from "@/components/AvatarPicker.vue";
import Alert from "@/components/Alert.vue";

definePageMeta({ layout: "me", middleware: "auth-client" });

const auth = useAuthStore();
const { user } = storeToRefs(auth);

const avatars = ref<Avatar[]>([]);
const nickname = ref(user.value?.nickname ?? "");
const avatarId = ref<string | null>(user.value?.avatarId ?? null);
const profileBusy = ref(false);
const profileMsg = ref<{ type: "info" | "success" | "danger"; text: string } | null>(null);

const oldPwd = ref("");
const newPwd = ref("");
const confirmPwd = ref("");
const pwdBusy = ref(false);
const pwdMsg = ref<{ type: "success" | "danger"; text: string } | null>(null);

onMounted(async () => {
  try {
    avatars.value = await api.avatars();
  } catch {
    /* noop */
  }
});

watch(user, (u) => {
  if (u) {
    nickname.value = u.nickname;
    avatarId.value = u.avatarId;
  }
});

async function saveProfile() {
  profileMsg.value = null;
  profileBusy.value = true;
  try {
    const patch: { nickname?: string; avatarId?: string } = {};
    if (user.value && nickname.value !== user.value.nickname) patch.nickname = nickname.value.trim();
    if (user.value && avatarId.value && avatarId.value !== user.value.avatarId) patch.avatarId = avatarId.value;
    if (Object.keys(patch).length === 0) {
      profileMsg.value = { type: "info", text: "没有改动" };
      return;
    }
    await api.updateProfile(patch);
    await auth.refreshMe();
    profileMsg.value = { type: "success", text: "已保存" };
  } catch (e) {
    profileMsg.value = {
      type: "danger",
      text: e instanceof ApiError ? e.message : "保存失败",
    };
  } finally {
    profileBusy.value = false;
  }
}

async function changePassword() {
  pwdMsg.value = null;
  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = { type: "danger", text: "两次输入的新密码不一致" };
    return;
  }
  pwdBusy.value = true;
  try {
    await api.changePassword({ currentPassword: oldPwd.value, newPassword: newPwd.value });
    pwdMsg.value = { type: "success", text: "密码已更新，3 秒后将自动登出。" };
    oldPwd.value = "";
    newPwd.value = "";
    confirmPwd.value = "";
    setTimeout(async () => {
      await auth.logout(false);
      window.location.assign("/login");
    }, 3000);
  } catch (e) {
    pwdMsg.value = {
      type: "danger",
      text: e instanceof ApiError ? e.message : "修改失败",
    };
  } finally {
    pwdBusy.value = false;
  }
}

function resetProfile() {
  if (user.value) {
    nickname.value = user.value.nickname;
    avatarId.value = user.value.avatarId;
  }
}
</script>

<template>
  <h1>账号设置</h1>

  <div class="cy-card" style="margin-bottom: var(--space-6)">
    <h2
      style="font-size: var(--font-size-xl); margin: 0 0 var(--space-5); font-family: var(--font-display)"
    >
      基本信息
    </h2>
    <form class="cy-form" @submit.prevent="saveProfile">
      <div class="cy-field">
        <label>邮箱</label>
        <input class="cy-input" :value="user?.email ?? ''" disabled />
        <span class="cy-field__hint">邮箱作为登录账号不可修改。</span>
      </div>
      <div class="cy-field">
        <label for="nick">昵称</label>
        <input id="nick" v-model="nickname" class="cy-input" :maxlength="20" />
      </div>
      <div class="cy-field">
        <label>头像</label>
        <AvatarPicker v-model="avatarId" :avatars="avatars" />
      </div>

      <Alert v-if="profileMsg" :variant="profileMsg.type">{{ profileMsg.text }}</Alert>

      <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
        <button type="button" class="cy-btn cy-btn--ghost" @click="resetProfile">
          重置
        </button>
        <button class="cy-btn cy-btn--primary" type="submit" :disabled="profileBusy">
          {{ profileBusy ? "保存中…" : "保存更改" }}
        </button>
      </div>
    </form>
  </div>

  <div class="cy-card" style="margin-bottom: var(--space-6)">
    <h2
      style="font-size: var(--font-size-xl); margin: 0 0 var(--space-5); font-family: var(--font-display)"
    >
      修改密码
    </h2>
    <form class="cy-form" @submit.prevent="changePassword">
      <div class="cy-field">
        <label for="oldPwd">当前密码</label>
        <input id="oldPwd" v-model="oldPwd" class="cy-input" type="password" required />
      </div>
      <div class="cy-field">
        <label for="newPwd">新密码</label>
        <input id="newPwd" v-model="newPwd" class="cy-input" type="password" required :minlength="8" />
        <span class="cy-field__hint">
          至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。
        </span>
      </div>
      <div class="cy-field">
        <label for="confirmPwd">确认新密码</label>
        <input
          id="confirmPwd"
          v-model="confirmPwd"
          class="cy-input"
          type="password"
          required
          :minlength="8"
        />
      </div>

      <Alert v-if="pwdMsg" :variant="pwdMsg.type">{{ pwdMsg.text }}</Alert>

      <div style="display:flex;justify-content:flex-end">
        <button class="cy-btn cy-btn--primary" type="submit" :disabled="pwdBusy">
          {{ pwdBusy ? "更新中…" : "更新密码" }}
        </button>
      </div>
    </form>
  </div>
</template>
