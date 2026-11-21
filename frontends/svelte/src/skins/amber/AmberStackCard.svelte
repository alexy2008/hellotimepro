<!-- 关于页的技术栈卡 -->
<script lang="ts">
  import { ROLE_LABEL, TECH_NOTE } from "@/lib/about";
  import TechIcon from "@/components/TechIcon.svelte";
  import type { StackItem } from "@/types";

  let { kind, en, path, items, summary }: { kind: string; en: string; path: string; items: StackItem[]; summary: string } = $props();
</script>

<article class="card card--pad stack-card">
  <div class="eyebrow">{en}</div>
  <h2 class="card__title">{kind}<small class="mono">{path}</small></h2>
  <p class="card__lead">{summary}</p>
  <ul class="stack-list">
    {#each items as it (it.role + it.name)}
      <li data-testid="stack-item" data-name={it.name}>
        <span class="stack-list__ic"><TechIcon item={it} base="tech-ic" /></span>
        <div>
          <b>{it.name}<small class="mono">{it.version}</small></b>
          <span>{TECH_NOTE[it.name] ?? ""}</span>
        </div>
        <em>{ROLE_LABEL[it.role] ?? it.role}</em>
      </li>
    {/each}
  </ul>
</article>
