<!-- 提示条容器：页面底部居中，逐条淡入淡出 -->
<script lang="ts">
  import { feedback } from "@/stores/feedback.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";

  const cls = { error: "err", info: "info", success: "ok" } as const;
  const icon = { error: "alert", info: "info", success: "check" } as const;
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each feedback.toasts as t (t.id)}
    <div data-testid="toast" data-tone={t.tone} class={["toast", `toast--${cls[t.tone]}`, t.shown && "is-in"]}>
      <AppIcon name={icon[t.tone]} />
      <span>{t.msg}</span>
    </div>
  {/each}
</div>
