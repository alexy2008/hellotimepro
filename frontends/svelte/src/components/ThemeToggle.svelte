<script lang="ts">
  import { themeStore } from "@/stores/theme.svelte.ts";
</script>

<button
  type="button"
  class="cy-theme-toggle"
  aria-label="切换主题"
  onclick={() => themeStore.toggle()}
>
  <span aria-hidden="true">{themeStore.theme === "dark" ? "☾" : "☀"}</span>
</button>
