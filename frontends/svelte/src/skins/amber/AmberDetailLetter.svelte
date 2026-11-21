<!-- 详情 · 已开启：信纸自上而下展开，邮戳「啪」地盖上（reveal 时） -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import { paragraphs } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import AmberBack from "./AmberBack.svelte";
  import AmberDetailActions from "./AmberDetailActions.svelte";
  import AmberStamp from "./AmberStamp.svelte";
  import AmberVisBadge from "./AmberVisBadge.svelte";
  import { dash } from "./art";

  let { c, reveal }: { c: CapsuleDetail; reveal: boolean } = $props();
  const openAt = $derived(ms(c.openAt));
  const createdAt = $derived(ms(c.createdAt));
</script>

<AmberBack />
<div class={["letter-page", reveal && "is-reveal"]}>
  <article class="letter">
    <div class="letter__meta">
      <span class="mono">{c.code}</span>
      <i></i>
      <AmberVisBadge inPlaza={c.inPlaza} />
    </div>
    <h1 class="letter__title" data-testid="detail-title">{c.title}</h1>
    <div class="letter__from">
      <AppAvatar id={c.creator.avatarId} />
      {c.creator.nickname} 写于 {fmt.cn(createdAt)}
    </div>
    <div class="letter__body" data-testid="detail-content">
      {#each paragraphs(c.content) as lines, i (i)}
        <p style:--i={i}>{#each lines as line, k (k)}{#if k}<br />{/if}{line}{/each}</p>
      {/each}
    </div>
    <footer class="letter__foot">
      <div class="letter__span">
        <div>
          <AppIcon name="hourglass" />
          这封信在时间里沉睡了 <b>{fmt.span(openAt - createdAt)}</b>
        </div>
        <span class="mono">{dash(createdAt)} 封存 → {dash(openAt)} 开启</span>
      </div>
      <div class="letter__sign">
        <AmberStamp date={openAt} />
        <span>—— {c.creator.nickname}</span>
      </div>
    </footer>
  </article>
  <AmberDetailActions {c} letter />
  {#if !c.inPlaza}
    <p class="tip tip--quiet">
      <AppIcon name="lock" />
      <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
    </p>
  {/if}
</div>
