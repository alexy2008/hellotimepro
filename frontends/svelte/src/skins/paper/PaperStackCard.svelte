<!-- 关于页的技术栈卡：一张「规格单」 -->
<script lang="ts">
  import { ROLE_LABEL, TECH_NOTE } from "@/lib/about";
  import TechIcon from "@/components/TechIcon.svelte";
  import type { StackItem } from "@/types";

  let { kind, title, sub, items, summary }: { kind: string; title: string; sub: string; items: StackItem[]; summary: string } = $props();
</script>

<article class="spec">
  <header class="spec__head">
    <div>
      <div class="spec__k">{kind}</div>
      <h3 class="spec__t serif">{title}</h3>
    </div>
    <span class="spec__sub mono">{sub}</span>
  </header>
  <ul class="spec__list">
    {#each items as it (it.role + it.name)}
      <li class="tech" data-testid="stack-item" data-name={it.name}>
        <TechIcon item={it} base="tech__ic" />
        <div class="tech__main">
          <b>{it.name}<small class="mono">{it.version}</small></b>
          <span>{TECH_NOTE[it.name] ?? ""}</span>
        </div>
        <em class="tech__role">{ROLE_LABEL[it.role] ?? it.role}</em>
      </li>
    {/each}
  </ul>
  <p class="spec__sum">{summary}</p>
</article>
