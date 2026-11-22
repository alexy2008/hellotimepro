<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";
import PaperSeal from "./PaperSeal.vue";
</script>

<template>
  <div class="page">
    <div class="wrap wrap--narrow detail">
      <div class="lost" data-testid="not-found">
        <div class="lost__mark"><PaperSeal ch="迷" variant="line" /></div>
        <h1 class="h1">查无此页</h1>
        <p>
          这个地址没有对应的页面。
          <br />
          也许是链接抄错了一位，也许它从未存在过。
        </p>
        <div class="lost__act">
          <NuxtLink class="btn btn--primary" to="/">回到广场</NuxtLink>
          <NuxtLink class="btn btn--ghost" to="/open"><AppIcon name="key" />凭码开启</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
