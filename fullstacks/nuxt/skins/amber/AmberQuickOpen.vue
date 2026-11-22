<!-- 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询 -->
<script setup lang="ts">
import { useCodeOpen } from "@/composables/useCodeOpen";
import AppIcon from "@/components/AppIcon.vue";
import AmberCodeInput from "./AmberCodeInput.vue";

const { state, error, shake, go, value, input: onChange } = useCodeOpen();
</script>

<template>
  <form class="quick card" novalidate @submit.prevent="go(value)">
    <div class="quick__k"><AppIcon name="key" />已有胶囊码？在这里开启</div>
    <div class="quick__row">
      <AmberCodeInput size="md" :value="value" :state="state" :shake="shake" @change="onChange" @complete="go" />
      <button class="btn btn--soft" type="submit">开启<AppIcon name="arrow" /></button>
    </div>
    <div class="quick__err" role="alert" :data-testid="error ? 'open-error' : undefined">{{ error }}</div>
  </form>
</template>
