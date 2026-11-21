<!-- 「时笺」首页主视觉：标题 · 两个入口 · 就地输码 · 此刻；右侧一叠信、信封、邮戳与精选纸条（鼠标视差） -->
<script lang="ts">
  import type { CapsuleListItem } from "@/types";
  import { fmt, ms, reducedMotion } from "@/lib/fmt";
  import { scrollToPlaza } from "@/state/plaza-home.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import CreateLink from "@/components/CreateLink.svelte";
  import PaperCdShort from "./PaperCdShort.svelte";
  import PaperEnvelope from "./PaperEnvelope.svelte";
  import PaperPostmark from "./PaperPostmark.svelte";
  import PaperQuickOpen from "./PaperQuickOpen.svelte";
  import PaperSeal from "./PaperSeal.svelte";

  let { now, featured }: { now: number; featured: CapsuleListItem | null } = $props();

  let hero = $state<HTMLElement>();
  let art = $state<HTMLElement>();

  function onpointermove(e: PointerEvent) {
    if (e.pointerType === "touch" || reducedMotion() || !hero || !art) return;
    const r = hero.getBoundingClientRect();
    art.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    art.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }
  function onpointerleave() {
    art?.style.setProperty("--mx", "0");
    art?.style.setProperty("--my", "0");
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section bind:this={hero} class="hero" {onpointermove} {onpointerleave}>
  <div class="wrap hero__in">
    <div class="hero__copy">
      <div class="overline"><i></i>HelloTime Pro · 时间胶囊</div>
      <h1 class="hero__title">
        <span class="hero__line">
          <span class="hero__clip"><span>把此刻，</span></span>
        </span>
        <span class="hero__line">
          <span class="hero__clip">
            <span>寄给<em class="hero__future" data-text="未来">未来</em></span>
          </span>
          <PaperSeal ch="封" class="hero__dot" />
        </span>
      </h1>
      <p class="hero__lede">
        写下一段话，再选一个启封的时刻。
        <br />
        在那之前，谁也打不开它——包括你自己。
      </p>
      <div class="hero__cta">
        <CreateLink class="btn btn--primary btn--lg" data-testid="home-create">
          <AppIcon name="pen" />
          <span>写一枚胶囊</span>
          <AppIcon name="arrow" class="ic--go" />
        </CreateLink>
        <a class="btn btn--ghost btn--lg" href="#plaza" onclick={scrollToPlaza}>
          <span>逛逛胶囊广场</span>
          <AppIcon name="arrow" class="ic--go" />
        </a>
      </div>
      <PaperQuickOpen />
      <div class="hero__now" aria-live="off">
        <span class="hero__now-k">此刻</span>
        <span>{fmt.cn(now)} {fmt.week(now)}</span>
        <span class="mono hero__now-t">{fmt.time(now, true)}</span>
        <span class="hero__lunar">{fmt.lunar(now)}</span>
      </div>
    </div>
    <div bind:this={art} class="hero__art">
      <div class="ha ha--letter" style:--depth={0.45} aria-hidden="true">
        <div class="ha-letter">
          <div class="ha-letter__to">致 未来 ——</div>
          <p>见字如面。</p>
          <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
          <p>但我想，你一定还记得……</p>
        </div>
      </div>
      <div class="ha ha--env" style:--depth={0.9} aria-hidden="true">
        <PaperEnvelope class="env--hero" />
      </div>
      <div class="ha ha--pm" style:--depth={1.2} aria-hidden="true">
        <PaperPostmark line1={fmt.date(now)} line2="此 刻" class="pm--hero" />
      </div>
      {#if featured}
        <a class="ha ha--slip" style:--depth={1.5} href={`/capsules/${featured.code}`} aria-label={`广场上最受期待的胶囊：${featured.title}`}>
          <div class="slip">
            <div class="slip__k"><span class="pulse-dot"></span>广场上最受期待的一枚</div>
            <div class="slip__t">{featured.title}</div>
            <div class="slip__cd"><PaperCdShort openAt={ms(featured.openAt)} {now} /></div>
            <div class="slip__f mono">
              <span>{featured.code}</span>
              <span class="slip__fav"><AppIcon name="heart" />{fmt.num(featured.favoriteCount)}</span>
            </div>
          </div>
        </a>
      {/if}
    </div>
  </div>
  <div class="hero__side" aria-hidden="true">
    <span>见字如面</span>
    <i></i>
    <span class="latin">Est. 2026</span>
  </div>
</section>
