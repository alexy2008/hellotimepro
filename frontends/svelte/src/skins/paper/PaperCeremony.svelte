<!-- ============================================================
     封缄仪式 → 取信凭证：信纸落进信封 → 封舌合上 → 火漆落下 → 凭证滑出。
     整层盖在页面之上，用 portal 附件挂到 body 下。
     ============================================================ -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { CapsuleDetail } from "@/types";
  import { fmt, reducedMotion, sleep } from "@/lib/fmt";
  import { share } from "@/stores/feedback.svelte.ts";
  import { portal } from "@/lib/attach";
  import AppIcon from "@/components/AppIcon.svelte";
  import PaperEnvelope from "./PaperEnvelope.svelte";

  let { c, onagain }: { c: CapsuleDetail; onagain: () => void } = $props();

  const openAt = $derived(new Date(c.openAt).getTime());
  let cls = $state("");
  let env = $state("is-open is-rising");
  let first = $state<HTMLButtonElement>();

  onMount(() => {
    let alive = true;
    void (async () => {
      const q = reducedMotion();
      await sleep(30);
      if (!alive) return;
      cls = "is-in";
      await sleep(q ? 0 : 520);
      env = "is-open"; // 信纸落进信封
      await sleep(q ? 0 : 760);
      env = ""; // 封舌合上
      await sleep(q ? 0 : 780);
      cls = "is-in is-stamped"; // 火漆落下
      await sleep(q ? 0 : 720);
      if (!alive) return;
      cls = "is-in is-stamped is-done"; // 凭证滑出
      first?.focus({ preventScroll: true });
    })();
    return () => (alive = false);
  });
</script>

<div {@attach portal} class={["cer", cls]} role="dialog" aria-modal="true" aria-label="封缄完成" data-testid="sealed-receipt" data-code={c.code}>
  <div class="cer__bg"></div>
  <div class="cer__in">
    <div class="cer__stage">
      <PaperEnvelope class={`env--cer ${env}`}><b>{c.title}</b><i></i><i></i><i></i><i></i></PaperEnvelope>
    </div>
    <div class="rcpt">
      <div class="rcpt__k">
        <span>封缄完成</span>
        <i></i>
        <span class="latin">Sealed</span>
      </div>
      <h2 class="rcpt__t serif">《{c.title}》</h2>
      <p class="rcpt__w">
        将于 <b>{fmt.full(openAt)}</b> 启封
        <br />
        还要等 {fmt.span(openAt - Date.now())}
      </p>
      <div class="rcpt__code mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
        {#each Array.from(c.code) as ch, i (i)}<span style:--i={i}>{ch}</span>{#if i === 3}<i></i>{/if}{/each}
      </div>
      <p class="rcpt__hint">
        这 8 位胶囊码是开启它的凭证。{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}
      </p>
      <div class="rcpt__act">
        <button bind:this={first} class="btn btn--primary" type="button" data-testid="copy-code" onclick={() => share.code(c.code)}><AppIcon name="copy" />复制胶囊码</button>
        <button class="btn btn--ghost" type="button" data-testid="copy-link" onclick={() => share.link(c.code)}><AppIcon name="link" />复制分享链接</button>
      </div>
      <div class="rcpt__more">
        <a href={`/capsules/${c.code}`} data-testid="receipt-view">查看这枚胶囊<AppIcon name="arrow" /></a>
        <button class="linkbtn" type="button" data-testid="receipt-again" onclick={onagain}><AppIcon name="pen" />再写一枚</button>
      </div>
    </div>
  </div>
</div>
