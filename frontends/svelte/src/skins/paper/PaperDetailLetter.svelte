<!-- 详情 · 已启封：一页信笺，字迹逐段显影（reveal 时） -->
<script lang="ts">
  import type { CapsuleDetail } from "@/types";
  import { fmt, ms } from "@/lib/fmt";
  import { paragraphs } from "@/state/capsule.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AppAvatar from "@/components/AppAvatar.svelte";
  import PaperBack from "./PaperBack.svelte";
  import PaperDetailActions from "./PaperDetailActions.svelte";
  import PaperPostmark from "./PaperPostmark.svelte";
  import PaperSeal from "./PaperSeal.svelte";
  import PaperVisTag from "./PaperVisTag.svelte";

  let { c, reveal }: { c: CapsuleDetail; reveal: boolean } = $props();
  const openAt = $derived(ms(c.openAt));
  const createdAt = $derived(ms(c.createdAt));
</script>

<PaperBack />
<article class={["letter", reveal && "letter--reveal"]}>
  <div class="letter__pm">
    <PaperPostmark line1={fmt.date(openAt)} line2="已 启 封" class="pm--letter" />
  </div>
  <div class="letter__meta">
    <span class="mono">NO. {c.code}</span>
    <PaperVisTag inPlaza={c.inPlaza} />
  </div>
  <h1 class="letter__title" data-testid="detail-title">{c.title}</h1>
  <dl class="letter__facts">
    <div>
      <dt>封存</dt>
      <dd class="mono">{fmt.dateTime(createdAt)}</dd>
    </div>
    <div>
      <dt>启封</dt>
      <dd class="mono">{fmt.dateTime(openAt)}</dd>
    </div>
    <div>
      <dt>在途</dt>
      <dd>{fmt.span(openAt - createdAt)}</dd>
    </div>
  </dl>
  <div class="letter__body" data-testid="detail-content">
    {#each paragraphs(c.content) as lines, i (i)}
      <p style:--i={i}>{#each lines as line, k (k)}{#if k}<br />{/if}{line}{/each}</p>
    {/each}
  </div>
  <footer class="letter__sign">
    <div class="letter__from">
      <span>——</span>
      <AppAvatar id={c.creator.avatarId} />
      <b>{c.creator.nickname}</b>
    </div>
    <div class="letter__date">写于 {fmt.cn(createdAt)}</div>
    <PaperSeal ch="启" variant="line" class="letter__seal" />
  </footer>
</article>
<PaperDetailActions {c} />
{#if c.inPlaza}
  <p class="note note--ok">
    <AppIcon name="check" />
    <span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span>
  </p>
{:else}
  <p class="note">
    <AppIcon name="lock" />
    <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
  </p>
{/if}
