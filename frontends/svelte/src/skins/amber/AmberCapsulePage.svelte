<!-- ============================================================
     「琥珀」胶囊详情（/capsules/:code）
     一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
     结构与类名照 2.0 原型 amber/view-capsule.js
     胶囊数据归路由（按码 {#key}）；开启动画归视图，视图销毁（换皮肤 / 离开）就中止
     ============================================================ -->
<script lang="ts">
  import { untrack } from "svelte";
  import { reducedMotion, sleep } from "@/lib/fmt";
  import { toast } from "@/stores/feedback.svelte.ts";
  import { clock } from "@/stores/clock.svelte.ts";
  import { useCapsule } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberDetailLetter from "./AmberDetailLetter.svelte";
  import AmberDetailLocked from "./AmberDetailLocked.svelte";

  const cs = useCapsule();
  const code = cs.code;

  let phase = $state<"" | "shaking" | "open">("");
  let reveal = $state(false);
  let task: AbortController | undefined;
  $effect(() => () => task?.abort());

  // 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上
  async function open() {
    task = new AbortController();
    const { signal } = task;
    if (!reducedMotion()) {
      phase = "shaking";
      window.scrollTo({ top: 0, behavior: "smooth" });
      await sleep(820);
      if (signal.aborted) return;
      phase = "open";
      await sleep(1150);
      if (signal.aborted) return;
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await cs.awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
    phase = "";
    reveal = true;
    toast("胶囊已开启");
  }
  $effect(() => {
    if (cs.expired && !task) untrack(() => void open());
  });

  const capsule = $derived(cs.capsule);
  const opened = $derived(!!capsule && capsule.isOpened && !phase);
</script>

<div class="page page--detail">
  <div
    class="container detail"
    data-testid={capsule ? "capsule-detail" : undefined}
    data-code={capsule?.code}
    data-state={capsule ? (opened ? "opened" : "sealed") : undefined}
    data-in-plaza={capsule ? String(capsule.inPlaza) : undefined}
  >
    {#if cs.status === "error"}
      <div class="notice card" role="alert">
        <p>暂时无法加载这枚胶囊，请稍后重试。</p>
        <button class="btn btn--ghost" type="button" onclick={() => cs.load()}>重试</button>
      </div>
    {:else if cs.status === "missing"}
      <div class="notice card" data-testid="detail-not-found">
        <AmberCapsuleArt code="LOST0000" state="opened" width={200} class="notice__art" />
        <div class="eyebrow">Not found</div>
        <h1 class="page-title">找不到这枚胶囊</h1>
        <p class="page-lead">
          {#if code}没有胶囊码为 <b class="mono">{code.toUpperCase()}</b> 的胶囊。{:else}这枚胶囊不存在。{/if}
          也许是码抄错了一位，也许它已经被作者删除了。
        </p>
        <div class="notice__act">
          <a class="btn btn--primary" href="/open"><AppIcon name="key" />重新输入胶囊码</a>
          <a class="btn btn--ghost" href="/">回到广场</a>
        </div>
      </div>
    {:else if capsule}
      {#if phase}
        <div class={["opening", phase === "open" && "is-open"]}>
          <div class="opening__burst"></div>
          <div class="opening__capsule">
            <AmberCapsuleArt code={capsule.code} state={phase === "open" ? "opened" : "locked"} width={300} />
          </div>
          <p class="opening__text">时间到了，正在开启……</p>
        </div>
      {:else if opened}
        <AmberDetailLetter c={capsule} {reveal} />
      {:else}
        <AmberDetailLocked c={capsule} now={clock.now} />
      {/if}
    {/if}
  </div>
</div>
