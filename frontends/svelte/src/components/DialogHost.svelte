<!-- ============================================================
     确认框：焦点圈定在卡片里，Esc 取消，关闭后焦点回到打开前的位置。
     正文是纯文本或「组件 + props」，小插画是「组件 + props」，都当普通组件渲染。
     ============================================================ -->
<script lang="ts">
  import { feedback } from "@/stores/feedback.svelte.ts";

  let shown = $state(false);
  let okBtn = $state<HTMLButtonElement>();
  let prevFocus: HTMLElement | null = null;
  const d = $derived(feedback.dialog);

  $effect(() => {
    if (!d) return;
    prevFocus = document.activeElement as HTMLElement | null;
    // 两帧之后再加 is-in，入场过渡才会生效
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        shown = true;
        okBtn?.focus();
      }),
    );
    return () => cancelAnimationFrame(raf);
  });

  function close(ok: boolean) {
    if (!d) return;
    shown = false;
    prevFocus?.focus?.();
    d.resolve(ok);
  }

  function onkeydown(e: KeyboardEvent) {
    if (d && e.key === "Escape") close(false);
  }

  /** 焦点圈定：Tab 在卡片内循环 */
  function trap(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const f = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("button, a[href], input, textarea");
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:document {onkeydown} />

{#if d}
  <div class={["dlg", shown && "is-in"]}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="dlg__scrim" onclick={() => close(false)}></div>
    <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="confirm-dialog" tabindex="-1" onkeydown={trap}>
      {#if d.mark}<d.mark.component {...d.mark.props} />{/if}
      <h2 id="dlg-t" class="dlg__t">{d.title}</h2>
      {#if d.body}
        <div class="dlg__b">
          {#if typeof d.body === "string"}<p>{d.body}</p>{:else}<d.body.component {...d.body.props} />{/if}
        </div>
      {/if}
      <div class="dlg__act">
        <button class="btn btn--ghost" type="button" data-testid="confirm-cancel" onclick={() => close(false)}>
          {d.cancel ?? "取消"}
        </button>
        <button bind:this={okBtn} class={["btn", `btn--${d.tone ?? "primary"}`]} type="button" data-testid="confirm-ok" onclick={() => close(true)}>
          {d.confirm ?? "确定"}
        </button>
      </div>
    </div>
  </div>
{/if}
