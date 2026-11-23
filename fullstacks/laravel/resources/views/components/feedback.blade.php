{{-- Toast 提示条 --}}
<div class="toasts" role="status" aria-live="polite">
  <template x-for="t in $store.feedback.toasts" :key="t.id">
    <div
      data-testid="toast"
      :data-tone="t.tone"
      :class="`toast toast--${t.tone === 'error' ? 'err' : t.tone === 'info' ? 'info' : 'ok'}${t.shown ? ' is-in' : ''}`"
    >
      <span style="display:contents" x-html="HT.iconSvg(t.tone === 'error' ? 'alert' : t.tone === 'info' ? 'info' : 'check')"></span>
      <span x-text="t.msg"></span>
    </div>
  </template>
</div>

{{-- 确认框 --}}
<template x-if="$store.feedback.dialog">
  <div class="dlg" :class="$store.feedback.dialogShown ? 'is-in' : ''">
    <div class="dlg__scrim" @click="$store.feedback.resolveDialog(false)"></div>
    <div
      class="dlg__card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-t"
      data-testid="confirm-dialog"
      @keydown.tab="
        const f = $el.querySelectorAll('button, a[href], input, textarea');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if ($event.shiftKey && document.activeElement === first) { $event.preventDefault(); last.focus(); }
        else if (!$event.shiftKey && document.activeElement === last) { $event.preventDefault(); first.focus(); }
      "
    >
      <template x-if="$store.feedback.dialog.markHtml">
        <div style="display:contents" x-html="$store.feedback.dialog.markHtml"></div>
      </template>
      <h2 id="dlg-t" class="dlg__t" x-text="$store.feedback.dialog.title"></h2>
      <template x-if="$store.feedback.dialog.bodyHtml">
        <div class="dlg__b" x-html="$store.feedback.dialog.bodyHtml"></div>
      </template>
      <div class="dlg__act">
        <button class="btn btn--ghost" type="button" data-testid="confirm-cancel" @click="$store.feedback.resolveDialog(false)" x-text="$store.feedback.dialog.cancel"></button>
        <button
          :class="`btn btn--${$store.feedback.dialog.tone || 'primary'}`"
          type="button"
          data-testid="confirm-ok"
          @click="$store.feedback.resolveDialog(true)"
          x-text="$store.feedback.dialog.confirm"
        ></button>
      </div>
    </div>
  </div>
</template>
