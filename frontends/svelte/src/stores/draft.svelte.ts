// ============================================================
// 创建页草稿：标题 / 正文 / 开启时刻 / 是否公开，只放在内存里。
// 切换皮肤、离开再回来都接着写；封存成功（只清本次提交的那一版）、登出、换了账号时清空——
// 草稿属于写它的那个人。
// ============================================================

import { untrack } from "svelte";
import { PRESET_AT } from "@/lib/schedule";
import { authStore } from "@/stores/auth.svelte.ts";

class DraftStore {
  title = $state("");
  content = $state("");
  openAt = $state(PRESET_AT["1y"]());
  /** 当前选中的预设；用标尺 / 日历 / AI 改了时刻后为 null */
  preset = $state<string | null>("1y");
  inPlaza = $state(true);
  /** 版本号：每改一次加一。封存成功时只有草稿还是提交那一版才清空 */
  revision = $state(0);

  patch(p: Partial<{ title: string; content: string; openAt: number; preset: string | null; inPlaza: boolean }>) {
    Object.assign(this, p);
    this.revision++;
  }

  reset() {
    this.patch({ title: "", content: "", openAt: PRESET_AT["1y"](), preset: "1y", inPlaza: true });
  }
}

export const draft = new DraftStore();

// 登出、登录态失效、换了另一个账号时一律清空，
// 免得同一标签页里下一位用户读到（甚至以自己的身份封存）上一位的草稿
$effect.root(() => {
  let prev = untrack(() => authStore.user?.id);
  $effect(() => {
    const id = authStore.user?.id;
    untrack(() => {
      if (prev && id !== prev) draft.reset();
      prev = id;
    });
  });
});
