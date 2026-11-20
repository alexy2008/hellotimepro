<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
</script>

<template>
  <div class="page">
    <div class="container">
      <div class="notice card" data-testid="not-found">
        <div class="notice__float"><AmberCapsuleArt code="NOWHERE0" state="opened" :width="220" /></div>
        <div class="eyebrow eyebrow--center">404</div>
        <h1 class="page-title">这一页飘走了</h1>
        <p class="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
        <div class="notice__act">
          <RouterLink class="btn btn--primary" to="/">回到广场</RouterLink>
          <RouterLink class="btn btn--ghost" to="/open"><AppIcon name="key" />凭码开启</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
