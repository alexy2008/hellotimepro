<!-- 已登录时页头右侧的头像菜单。createdIcon：两套皮肤给「我创建的」配的图标不同 -->
<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/feedback";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import type { IconName } from "@/lib/icons";

defineProps<{ createdIcon: IconName }>();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const open = ref(false);
const box = useTemplateRef<HTMLElement>("box");

const onDoc = (e: MouseEvent) => {
  if (!box.value?.contains(e.target as Node)) open.value = false;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};
const unbind = () => {
  document.removeEventListener("click", onDoc);
  document.removeEventListener("keydown", onKey);
};
watch(open, (v) => {
  unbind();
  if (!v) return;
  document.addEventListener("click", onDoc);
  document.addEventListener("keydown", onKey);
});
watch(() => route.path, () => (open.value = false));
onBeforeUnmount(unbind);

async function logout() {
  open.value = false;
  await auth.logout(true);
  toast("已登出");
  await router.push("/");
}
</script>

<template>
  <div v-if="auth.user" ref="box" :class="['umenu', { 'is-open': open }]">
    <button
      class="uchip"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="`${auth.user.nickname} 的菜单`"
      data-testid="user-menu"
      :data-nickname="auth.user.nickname"
      @click="open = !open"
    >
      <AppAvatar :id="auth.user.avatarId" />
      <span class="uchip__n">{{ auth.user.nickname }}</span>
      <AppIcon name="chev-down" class="ic--chev" />
    </button>
    <div class="umenu__pop" role="menu">
      <div class="umenu__who">
        <AppAvatar :id="auth.user.avatarId" class="av--lg" />
        <div>
          <b>{{ auth.user.nickname }}</b>
          <span class="mono">{{ auth.user.email }}</span>
        </div>
      </div>
      <NuxtLink role="menuitem" to="/me/created" data-testid="menu-created"><AppIcon :name="createdIcon" />我创建的</NuxtLink>
      <NuxtLink role="menuitem" to="/me/favorites" data-testid="menu-favorites"><AppIcon name="heart" />我收藏的</NuxtLink>
      <NuxtLink role="menuitem" to="/me/profile" data-testid="menu-profile"><AppIcon name="sliders" />账号设置</NuxtLink>
      <hr />
      <button role="menuitem" type="button" data-testid="logout" @click="logout"><AppIcon name="logout" />登出</button>
    </div>
  </div>
</template>
