<!-- 登录 / 注册 共用的左侧题字：两句诗、出处、一枚印、一个邮戳 -->
<script setup lang="ts">
import { fmt } from "@/lib/fmt";
import PaperLogo from "./PaperLogo.vue";
import PaperPostmark from "./PaperPostmark.vue";
import PaperSeal from "./PaperSeal.vue";

defineProps<{ poem: string[]; src: string; seal: string }>();
const today = fmt.date(Date.now());
</script>

<template>
  <aside class="auth__art" aria-hidden="true">
    <div class="auth__brand">
      <PaperLogo />
      <span class="latin">HelloTime</span>
    </div>
    <div class="auth__poem serif">
      <span v-for="l in poem" :key="l">{{ l }}</span>
    </div>
    <div class="auth__foot">
      <span>{{ src }}</span>
      <PaperSeal :ch="seal" class="auth__seal" />
    </div>
    <div class="auth__pm">
      <PaperPostmark :line1="today" line2="此 刻" class="pm--auth" />
    </div>
  </aside>
</template>
