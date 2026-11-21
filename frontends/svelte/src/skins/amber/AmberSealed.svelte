<!-- 封存完成：胶囊合拢，8 位码牌逐个翻出 -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { fmt, reducedMotion } from "@/lib/fmt";
  import { paletteOf } from "@/lib/palette";
  import { share } from "@/stores/feedback.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AmberCapsuleArt from "./AmberCapsuleArt.svelte";
  import AmberVisBadge from "./AmberVisBadge.svelte";
  import { dash } from "./art";

  let { c, onagain }: { c: CapsuleDetail; onagain: () => void } = $props();

  const openAt = $derived(new Date(c.openAt).getTime());
  let inn = $state(false);
  $effect(() => {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => (inn = true))));
    return () => cancelAnimationFrame(raf);
  });
</script>

<section class={["sealed", "card", inn && "is-in"]} style:--glow={paletteOf(c.code).glow} data-testid="sealed-receipt" data-code={c.code}>
  <div class="sealed__art"><AmberCapsuleArt code={c.code} state={inn ? "locked" : "opened"} width={260} /></div>
  <div class="eyebrow eyebrow--center">Sealed</div>
  <h1 class="page-title">胶囊已封存</h1>
  <p class="page-lead">下面这串胶囊码是开启它的钥匙，{c.inPlaza ? "它也会出现在胶囊广场上。" : "它不会出现在广场，把码交给谁，谁才能找到它。"}</p>
  <div class="tiles mono" aria-label={`胶囊码 ${c.code}`} data-testid="sealed-code">
    {#each Array.from(c.code) as ch, i (i)}<span class={["tile", i === 4 && "has-gap"]} style:--i={i}>{ch}</span>{/each}
  </div>
  <div class="sealed__act">
    <button class="btn btn--primary" type="button" data-testid="copy-code" onclick={() => share.code(c.code)}><AppIcon name="copy" />复制胶囊码</button>
    <button class="btn btn--ghost" type="button" data-testid="copy-link" onclick={() => share.link(c.code)}><AppIcon name="link" />复制开启链接</button>
  </div>
  <dl class="sealed__meta">
    <div>
      <dt>标题</dt>
      <dd>{c.title}</dd>
    </div>
    <div>
      <dt>开启时间</dt>
      <dd class="mono">{dash(openAt)}</dd>
    </div>
    <div>
      <dt>沉睡时长</dt>
      <dd>{fmt.span(openAt - Date.now())}</dd>
    </div>
    <div>
      <dt>属性</dt>
      <dd><AmberVisBadge inPlaza={c.inPlaza} /></dd>
    </div>
  </dl>
  <div class="sealed__links">
    <a class="link-btn" href={`/capsules/${c.code}`} data-testid="receipt-view">看看它的倒计时<AppIcon name="arrow" /></a>
    <button class="link-btn" type="button" data-testid="receipt-again" onclick={onagain}>再写一枚<AppIcon name="plus" /></button>
    <a class="link-btn" href="/me/created">我创建的<AppIcon name="feather" /></a>
  </div>
</section>
