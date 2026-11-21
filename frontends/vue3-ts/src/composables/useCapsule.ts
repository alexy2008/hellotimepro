// ============================================================
// 胶囊详情与开启页的共享逻辑（两套皮肤共用）
// ============================================================

import { computed, onScopeDispose, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { copyText } from "@/stores/feedback";
import { useNow } from "@/composables/useNow";
import { ApiError, type CapsuleDetail, type CapsuleListItem } from "@/types";
import { ms, sleep } from "@/lib/fmt";

export type DetailStatus = "loading" | "ok" | "missing" | "error";

/**
 * 按码取胶囊。未开启时逐秒倒数，归零那一刻 expired 变 true——
 * 皮肤据此播放开启动画，并调用 awaitOpened(signal) 拿到正文（不用刷新页面）。
 */
export function useCapsuleByCode(code: MaybeRefOrGetter<string>) {
  const auth = useAuthStore();
  const now = useNow();
  const capsule = shallowRef<CapsuleDetail | null>(null);
  const status = ref<DetailStatus>("loading");
  /** 换了码或离开页面就加一，作废进行中的等待 */
  let gen = 0;
  /** 取数序列号：只认最后一次 */
  let loadSeq = 0;

  async function load() {
    const my = ++loadSeq;
    const g = gen;
    const stale = () => my !== loadSeq || g !== gen;
    try {
      const d = await api.capsuleByCode(toValue(code));
      if (stale()) return null;
      capsule.value = d;
      status.value = "ok";
      return d;
    } catch (e) {
      if (!stale()) status.value = e instanceof ApiError && e.status === 404 ? "missing" : "error";
      return null;
    }
  }

  // 换了码重新取；登录态变了，favoritedByMe 也会变
  watch(
    [() => toValue(code), () => auth.user?.id],
    ([c], prev) => {
      if (c !== prev?.[0]) {
        gen++;
        status.value = "loading";
        capsule.value = null;
      }
      void load();
    },
    { immediate: true },
  );
  onScopeDispose(() => gen++);

  /**
   * 倒数归零后取正文：以服务端的 isOpened 为准。本机时钟可能比服务端快几秒，
   * 这时接口仍返回未开启——隔一会儿再问（1s、2s…最多 5s 一次），直到真正开启；
   * 离开页面、换了码或胶囊已被删除（404）时返回 null
   */
  async function awaitOpened(signal: AbortSignal): Promise<CapsuleDetail | null> {
    const my = gen;
    for (let i = 0; my === gen && !signal.aborted; i++) {
      try {
        const d = await api.capsuleByCode(toValue(code));
        if (my !== gen || signal.aborted) return null;
        if (d.isOpened) {
          capsule.value = d;
          return d;
        }
      } catch (e) {
        if (my !== gen || signal.aborted) return null;
        if (e instanceof ApiError && e.status === 404) {
          status.value = "missing";
          return null;
        }
      }
      await sleep(Math.min(1000 * (i + 1), 5000));
    }
    return null;
  }

  watch(capsule, (c) => {
    if (c) document.title = `${c.title} · HelloTime Pro`;
  });

  const expired = computed(() => !!capsule.value && !capsule.value.isOpened && ms(capsule.value.openAt) <= now.value);
  return { capsule, status, now, expired, reload: load, awaitOpened };
}

/** 复制码与分享链接 */
export function useShare(code: MaybeRefOrGetter<string>) {
  return {
    copyCode: () => {
      const c = toValue(code);
      void copyText(c, `已复制胶囊码 ${c}`);
    },
    copyLink: () => void copyText(`${window.location.origin}/capsules/${toValue(code)}`, "已复制分享链接"),
  };
}

/** 开启页「我封存过的胶囊」：登录后取最近 3 枚 */
export function useMySealed() {
  const auth = useAuthStore();
  const items = ref<CapsuleListItem[]>([]);
  let seq = 0;
  watch(
    () => auth.user?.id,
    (id) => {
      const my = ++seq;
      if (!id) return void (items.value = []);
      api
        .myCapsules(1, 3)
        .then((r) => my === seq && (items.value = r.items))
        .catch(() => undefined);
    },
    { immediate: true },
  );
  onScopeDispose(() => seq++);
  return items;
}

/** 正文按空行分段，每段再按单个换行拆成行 */
export const paragraphs = (text: string | null | undefined) =>
  String(text ?? "")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => p.split("\n"));
