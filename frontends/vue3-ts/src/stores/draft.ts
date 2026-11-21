// ============================================================
// 创建页草稿：标题 / 正文 / 开启时刻 / 是否公开，只放在内存里。
// 切换皮肤（视图整个换掉）、离开再回来都接着写；
// 封存成功、登出、换了账号时清空——草稿属于写它的那个人。
// ============================================================

import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { PRESET_AT } from "@/lib/schedule";
import { useAuthStore } from "@/stores/auth";

export const useDraftStore = defineStore("draft", () => {
  const title = ref("");
  const content = ref("");
  const openAt = ref(PRESET_AT["1y"]());
  /** 当前选中的预设；用标尺 / 日历 / AI 改了时刻后为 null */
  const preset = ref<string | null>("1y");
  const inPlaza = ref(true);

  const revision = ref(0);
  watch([title, content, openAt, preset, inPlaza], () => revision.value++, { flush: "sync" });

  function reset() {
    revision.value++;
    title.value = "";
    content.value = "";
    openAt.value = PRESET_AT["1y"]();
    preset.value = "1y";
    inPlaza.value = true;
  }

  // 登出、登录态失效、换了另一个账号时一律清空，
  // 免得同一标签页里下一位用户读到（甚至以自己的身份封存）上一位的草稿
  const auth = useAuthStore();
  watch(
    () => auth.user?.id,
    (id, prev) => {
      if (prev && id !== prev) reset();
    },
  );

  return { revision, title, content, openAt, preset, inPlaza, reset };
});
