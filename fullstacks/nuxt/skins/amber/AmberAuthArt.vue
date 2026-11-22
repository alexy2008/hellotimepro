<!-- 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊 -->
<script setup lang="ts">
import AmberCapsuleArt from "./AmberCapsuleArt.vue";

defineProps<{ state: "locked" | "opened" }>();
</script>

<template>
  <div class="auth__art" aria-hidden="true">
    <span class="auth__orbit" />
    <span class="auth__orbit auth__orbit--2" />
    <AmberCapsuleArt :code="null" :state="state" :width="180" />
  </div>
</template>
