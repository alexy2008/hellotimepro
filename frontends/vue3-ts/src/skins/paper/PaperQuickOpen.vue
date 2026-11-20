<!-- 首页就地输码：与开启页同一个部件（X3），满 8 位自动查询 -->
<script setup lang="ts">
import { ref } from "vue";
import { useCodeOpen } from "@/composables/useCodeOpen";
import AppIcon from "@/components/AppIcon.vue";
import PaperCodeInput from "./PaperCodeInput.vue";

const { state, error, shake, go, reset } = useCodeOpen();
const value = ref("");
const onChange = (v: string) => {
  value.value = v;
  reset();
};
</script>

<template>
  <form :class="['hquick', { 'is-full': value.length === 8 }]" novalidate @submit.prevent="go(value)">
    <div class="hquick__k"><AppIcon name="key" />已有胶囊码？在这里开启</div>
    <div class="hquick__row">
      <PaperCodeInput size="sm" :state="state" :shake="shake" @change="onChange" @complete="go" />
      <button class="hquick__go" type="submit" aria-label="开启"><AppIcon name="arrow" /></button>
    </div>
    <div class="hquick__err" role="alert" :data-testid="error ? 'open-error' : undefined">{{ error }}</div>
  </form>
</template>
