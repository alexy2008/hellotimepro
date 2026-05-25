<script lang="ts">
  import { api } from "@/api/client";
  import type { HealthData } from "@/types";

  const FRONTEND_ITEMS = [
    { role: "frontend-framework", name: "Svelte 5", iconUrl: "/static/icons/svelte.svg" },
    { role: "frontend-language", name: "TypeScript", iconUrl: "/static/icons/typescript.svg" },
    { role: "frontend-styling", name: "Tailwind CSS", iconUrl: "/static/icons/tailwindcss.svg" },
  ];

  let health = $state<HealthData | null>(null);
  let connected = $state<boolean | null>(null);

  $effect(() => {
    void (async () => {
      try {
        health = await api.health();
        connected = true;
      } catch {
        connected = false;
      }
    })();
  });

  const backendItems = $derived(health?.stack.items ?? []);
  const dotClass = $derived(
    connected === true
      ? "cy-backend-dot cy-backend-dot--online"
      : connected === false
        ? "cy-backend-dot cy-backend-dot--offline"
        : "cy-backend-dot",
  );
  const dotTitle = $derived(
    connected === true ? "后端在线" : connected === false ? "后端离线" : "连接中…",
  );
</script>

<footer class="cy-footer">
  <div class="cy-container cy-footer__inner">
    <div style:display="flex" style:align-items="center" style:gap="6px">
      © 2026 HelloTime Pro
      <span class={dotClass} title={dotTitle}></span>
    </div>
    <div class="cy-stack">
      {#each FRONTEND_ITEMS as it (it.role)}
        <span class="cy-stack__item" title={it.role}>
          <img src={it.iconUrl} alt="" />
          {it.name}
        </span>
      {/each}
      {#each backendItems as it (it.role + "-" + it.name)}
        <span class="cy-stack__item" title={it.role}>
          {#if it.iconUrl}<img src={it.iconUrl} alt="" />{/if}
          {it.name}
        </span>
      {/each}
    </div>
  </div>
</footer>
