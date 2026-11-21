<!-- ============================================================
     「时笺」胶囊详情（/capsules/:code）
     三种形态：未启封（信封 + 翻页倒计时 + 刻度尺）→ 启封动画 → 已启封（信笺）
     结构与类名照 2.0 原型 paper/view-capsule.js
     胶囊数据归路由（按码 {#key}）；启封动画归视图，视图销毁（换皮肤 / 离开）就中止
     ============================================================ -->
<script lang="ts">
  import { untrack } from "svelte";
  import { reducedMotion, sleep } from "@/lib/fmt";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { useCapsule } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperDetailLetter from "./PaperDetailLetter.svelte";
  import PaperDetailSealed from "./PaperDetailSealed.svelte";
  import PaperSeal from "./PaperSeal.svelte";
  import type { Opening } from "./art";

  const cs = useCapsule();
  const code = cs.code;

  let opening = $state<Opening | null>(null);
  let host = $state("");
  let reveal = $state(false);
  let task: AbortController | undefined;
  $effect(() => () => task?.abort());

  // 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影
  async function open() {
    task = new AbortController();
    const { signal } = task;
    opening = { crack: "whole", open: false, rising: false };
    host = "is-opening";
    if (!reducedMotion()) {
      opening = { crack: "split", open: false, rising: false };
      await sleep(60);
      if (signal.aborted) return;
      opening = { crack: "cracked", open: false, rising: false };
      await sleep(620);
      if (signal.aborted) return;
      opening = { crack: "cracked", open: true, rising: false };
      await sleep(760);
      if (signal.aborted) return;
      opening = { crack: "cracked", open: true, rising: true };
      await sleep(900);
      if (signal.aborted) return;
      host = "is-opening is-leaving";
      await sleep(380);
      if (signal.aborted) return;
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await cs.awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
    host = "";
    opening = null;
    reveal = true;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    toast("胶囊已启封");
  }
  $effect(() => {
    if (cs.expired && !task) untrack(() => void open());
  });

  const capsule = $derived(cs.capsule);
  const opened = $derived(!!capsule && capsule.isOpened && !opening);
</script>

<div class="page page--detail">
  <div
    class={["wrap", "wrap--narrow", "detail", host]}
    data-testid={capsule ? "capsule-detail" : undefined}
    data-code={capsule?.code}
    data-state={capsule ? (opened ? "opened" : "sealed") : undefined}
    data-in-plaza={capsule ? String(capsule.inPlaza) : undefined}
  >
    {#if cs.status === "error"}
      <div class="lost" role="alert">
        <p>暂时无法加载这枚胶囊，请稍后重试。</p>
        <button class="btn btn--ghost" type="button" onclick={() => cs.load()}>重试</button>
      </div>
    {:else if cs.status === "missing"}
      <div class="lost" data-testid="detail-not-found">
        <div class="lost__mark"><PaperSeal ch="无" variant="line" /></div>
        <h1 class="h1">查无此信</h1>
        <p>
          {#if code}没有找到胶囊码为 <b class="mono">{code.toUpperCase()}</b> 的胶囊。{:else}这枚胶囊不存在。{/if}
          <br />
          它也可能已经被作者删除了。
        </p>
        <div class="lost__act">
          <a class="btn btn--primary" href="/open"><AppIcon name="key" />重新输入胶囊码</a>
          <a class="btn btn--ghost" href="/">回到广场</a>
        </div>
      </div>
    {:else if capsule}
      {#if opened}
        <PaperDetailLetter c={capsule} {reveal} />
      {:else}
        <PaperDetailSealed c={capsule} now={clock.now} {opening} />
      {/if}
    {/if}
  </div>
</div>
