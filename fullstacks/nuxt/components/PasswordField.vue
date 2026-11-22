<!-- 密码字段：右侧一只眼睛，点一下明文 / 密文切换 -->
<script setup lang="ts">
import { ref } from "vue";
import { useUiStore } from "@/stores/ui";
import FormField from "@/components/FormField.vue";
import AppIcon from "@/components/AppIcon.vue";
import type { FieldProps } from "@/components/field";

const model = defineModel<string>({ default: "" });
const props = defineProps<FieldProps>();
const ui = useUiStore();
const show = ref(false);
</script>

<template>
  <FormField v-bind="props" v-model="model" :input-type="show ? 'text' : 'password'">
    <template #trail>
      <button
        :class="ui.skin === 'paper' ? 'field__eye' : 'input-wrap__action icon-btn'"
        type="button"
        :aria-label="show ? '隐藏密码' : '显示密码'"
        @click="show = !show"
      >
        <AppIcon :name="show ? 'eye-off' : 'eye'" />
      </button>
    </template>
  </FormField>
</template>
