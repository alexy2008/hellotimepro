<!-- 「时笺」手机底栏（桌面宽度下由样式隐藏） -->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { navAttrs, useNavKey } from "@/composables/useShell";
import AppIcon from "@/components/AppIcon.vue";
import AppAvatar from "@/components/AppAvatar.vue";
import CreateLink from "@/components/CreateLink.vue";

const auth = useAuthStore();
const cur = useNavKey();
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <RouterLink to="/" data-testid="tab-plaza" v-bind="navAttrs('plaza', cur)"><AppIcon name="grid" /><span>广场</span></RouterLink>
    <RouterLink to="/open" data-testid="tab-open" v-bind="navAttrs('open', cur)"><AppIcon name="key" /><span>开启</span></RouterLink>
    <CreateLink data-testid="tab-create" v-bind="navAttrs('create', cur, 'tabbar__main')">
      <i><AppIcon name="pen" /></i>
      <span>写信</span>
    </CreateLink>
    <RouterLink :to="auth.user ? '/me/created' : '/login'" data-testid="tab-me" v-bind="navAttrs('me', cur)">
      <AppAvatar v-if="auth.user" :id="auth.user.avatarId" />
      <AppIcon v-else name="user" />
      <span>{{ auth.user ? "我的" : "登录" }}</span>
    </RouterLink>
  </nav>
</template>
