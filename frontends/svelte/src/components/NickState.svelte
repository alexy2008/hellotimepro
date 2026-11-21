<!-- 昵称右侧的状态点：格式通过打勾，不通过（或重名）打叉 -->
<script lang="ts">
  import { ui } from "@/stores/ui.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import type { NickStateValue } from "@/state/account.svelte.ts";

  let { state }: { state: NickStateValue } = $props();
  const good = $derived(state === "valid");
  const bad = $derived(state === "invalid" || state === "taken");
</script>

<span
  class={[ui.skin === "paper" ? "field__state" : "input-wrap__action nick-state", { "is-good": good, "is-bad": bad }]}
  aria-hidden="true"
  data-testid={state ? "nickname-state" : undefined}
  data-state={state || undefined}
>
  {#if good}<AppIcon name="check" />{:else if bad}<AppIcon name="x" />{/if}
</span>
