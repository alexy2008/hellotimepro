<!-- ============================================================
     指向 /create 的链接：已登录直接去；匿名时先确认，再去 /login?redirect=/create。
     用 RouterLink 的 custom 插槽自己渲染 <a>，这样才能在导航之前拦下匿名点击。
     类名、data-testid 等透传到 <a> 上。
     ============================================================ -->
<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { askLogin } from "@/composables/useLoginPrompt";
import { loginPath } from "@/lib/redirect";

defineOptions({ inheritAttrs: false });

const auth = useAuthStore();
const router = useRouter();

async function onClick(e: MouseEvent, navigate: (e?: MouseEvent) => unknown) {
  if (auth.user) return void navigate(e);
  e.preventDefault();
  if (await askLogin("create")) await router.push(loginPath("/create"));
}
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" to="/create" custom>
    <a v-bind="$attrs" :href="href" @click="onClick($event, navigate)"><slot /></a>
  </RouterLink>
</template>
