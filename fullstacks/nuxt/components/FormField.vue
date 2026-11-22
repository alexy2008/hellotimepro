<!-- ============================================================
     表单字段：两套皮肤结构相同、外框不同——
     时笺是下划线信笺栏，琥珀是带图标的输入框。逻辑只写一份。
     值用 v-model；输入框右侧的小部件（眼睛、昵称状态、锁）走 #trail 插槽。
     出错时自带 field-error 测试钩子，并抖一下。
     ============================================================ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import { useUiStore } from "@/stores/ui";
import { useShake } from "@/composables/useMotion";
import { focusIfIdle } from "@/lib/fmt";
import AppIcon from "@/components/AppIcon.vue";
import type { FieldProps } from "@/components/field";

const model = defineModel<string>({ default: "" });
const props = defineProps<FieldProps & { inputType?: string }>();
defineSlots<{ trail?: () => unknown }>();

const ui = useUiStore();
const shaking = useShake(() => props.error);
const input = useTemplateRef<HTMLInputElement>("input");

let t = 0;
onMounted(() => {
  if (props.autofocus) t = window.setTimeout(() => focusIfIdle(input.value), 380);
});
onBeforeUnmount(() => clearTimeout(t));

const inputAttrs = computed(() => ({
  id: props.id,
  name: props.id,
  type: props.inputType ?? props.type ?? "text",
  autocomplete: props.autocomplete,
  placeholder: props.placeholder,
  maxlength: props.maxlength,
  disabled: props.disabled,
  "aria-describedby": `${props.id}-hint`,
  "aria-invalid": props.error ? true : undefined,
  "data-testid": props.testId,
}));
</script>

<template>
  <div :class="['field', { 'is-error': error, 'is-ok': !error && ok }]" :data-field="id">
    <template v-if="ui.skin === 'paper'">
      <label class="field__label" :for="id">{{ label }}</label>
      <div :class="['field__box', { 'is-shake': shaking }]">
        <input ref="input" v-model="model" class="field__input" v-bind="inputAttrs" />
        <slot name="trail" />
        <span class="field__line" />
      </div>
    </template>
    <template v-else>
      <div class="field__head">
        <label class="field__label" :for="id">{{ label }}<em v-if="req"> *</em></label>
      </div>
      <div :class="['input-wrap', { 'input-wrap--icon': lead, 'input-wrap--action': $slots.trail, 'is-shake': shaking }]">
        <AppIcon v-if="lead" :name="lead" class="input-wrap__icon" />
        <input ref="input" v-model="model" class="input" v-bind="inputAttrs" />
        <slot name="trail" />
      </div>
    </template>
    <div
      :id="`${id}-hint`"
      class="field__hint"
      :data-testid="error ? 'field-error' : undefined"
      :data-field="error ? (errorKey ?? id) : undefined"
    >
      {{ error || ok || hint }}
    </div>
  </div>
</template>
