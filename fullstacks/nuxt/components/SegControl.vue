<!-- ============================================================
     分段选择：一排按钮 + 一块跟着选中项滑动的底（.seg__thumb）。
     泛型组件：v-model 的类型就是选项值的联合类型（如 PlazaSort）。
     两套皮肤同一份标记，长相由 spec/styles 决定。
     ============================================================ -->
<script setup lang="ts" generic="T extends string">
import { useTemplateRef } from "vue";
import AppIcon from "@/components/AppIcon.vue";
import { useSlider } from "@/composables/useMotion";
import type { SegOption } from "@/components/seg";

const model = defineModel<T>({ required: true });
const props = defineProps<{ label: string; options: SegOption<T>[]; testid: string }>();

const box = useTemplateRef<HTMLElement>("box");
// 选中项变了、数量从无到有（按钮变宽）都要重新对齐
const thumb = useSlider(box, ".seg__opt.is-active", [model, () => props.options.map((o) => o.count ?? "").join(",")]);

const pick = (v: T) => {
  if (v !== model.value) model.value = v;
};
</script>

<template>
  <div ref="box" class="seg" role="group" :aria-label="label">
    <span class="seg__thumb" :style="thumb" />
    <button
      v-for="o in options"
      :key="o.value"
      :class="['seg__opt', { 'is-active': o.value === model }]"
      type="button"
      :aria-pressed="o.value === model"
      :data-testid="testid"
      :data-value="o.value"
      :data-selected="o.value === model"
      :data-count="o.count ?? undefined"
      @click="pick(o.value)"
    >
      <AppIcon v-if="o.icon" :name="o.icon" />{{ o.label }}<sup v-if="o.count != null">{{ o.count }}</sup>
    </button>
  </div>
</template>
