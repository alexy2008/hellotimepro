<!-- ============================================================
     确认框：焦点圈定在卡片里，Esc 取消，关闭后焦点回到打开前的位置。
     正文与小插画是调用方给的函数式组件，用 <component :is> 渲染。
     ============================================================ -->
<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { storeToRefs } from "pinia";
import { useFeedbackStore } from "@/stores/feedback";

const { dialog } = storeToRefs(useFeedbackStore());
const shown = ref(false);
const okBtn = useTemplateRef<HTMLButtonElement>("okBtn");
let prevFocus: HTMLElement | null = null;

const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") close(false);
};

watch(
  dialog,
  (d, _, onCleanup) => {
    if (!d) return;
    prevFocus = document.activeElement as HTMLElement | null;
    // 两帧之后再加 is-in，入场过渡才会生效
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        shown.value = true;
        okBtn.value?.focus();
      }),
    );
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    });
  },
  { flush: "post" },
);
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));

function close(ok: boolean) {
  const d = dialog.value;
  if (!d) return;
  shown.value = false;
  prevFocus?.focus?.();
  d.resolve(ok);
}

/** 焦点圈定：Tab 在卡片内循环 */
function trap(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const f = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("button, a[href], input, textarea");
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <div v-if="dialog" :class="['dlg', { 'is-in': shown }]">
    <div class="dlg__scrim" @click="close(false)" />
    <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="confirm-dialog" @keydown="trap">
      <component :is="dialog.mark" v-if="dialog.mark" />
      <h2 id="dlg-t" class="dlg__t">{{ dialog.title }}</h2>
      <div v-if="dialog.body" class="dlg__b"><component :is="dialog.body" /></div>
      <div class="dlg__act">
        <button class="btn btn--ghost" type="button" data-testid="confirm-cancel" @click="close(false)">
          {{ dialog.cancel ?? "取消" }}
        </button>
        <button ref="okBtn" :class="['btn', `btn--${dialog.tone ?? 'primary'}`]" type="button" data-testid="confirm-ok" @click="close(true)">
          {{ dialog.confirm ?? "确定" }}
        </button>
      </div>
    </div>
  </div>
</template>
