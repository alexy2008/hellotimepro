<script lang="ts">
  import { ROLE_LABEL } from "@/lib/about";
  import TechIcon from "@/components/TechIcon.svelte";
  import type { StackItem } from "@/types";

  let { it }: { it: StackItem } = $props();
</script>

<span class="ftr__tech" title={`${ROLE_LABEL[it.role] ?? it.role} · ${it.name} ${it.version ?? ""}`} data-testid="stack-item" data-name={it.name}>
  <TechIcon item={it} base="tech-ic" />
  {it.name}
</span>
