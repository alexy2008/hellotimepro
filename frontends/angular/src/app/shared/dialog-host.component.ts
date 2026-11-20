// ============================================================
// 确认框：焦点圈定在卡片里，Esc 取消，关闭后焦点回到打开前的位置。
// 正文可以是一段文字，也可以是调用方给的组件（*ngComponentOutlet 渲染，带输入）。
// ============================================================

import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, signal, untracked, viewChild } from '@angular/core';
import { FeedbackStore } from '@/stores/feedback.store';
import { CONTENTS } from './host';

@Component({
  selector: 'app-dialog-host',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ...CONTENTS, '(document:keydown.escape)': 'close(false)' },
  template: `
    @if (feedback.dialog(); as d) {
      <div class="dlg" [class.is-in]="shown()">
        <div class="dlg__scrim" (click)="close(false)"></div>
        <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-testid="confirm-dialog" (keydown)="trap($event)">
          @if (d.mark; as m) {
            <ng-container *ngComponentOutlet="m.component; inputs: m.inputs ?? {}" />
          }
          <h2 id="dlg-t" class="dlg__t">{{ d.title }}</h2>
          @if (d.body) {
            <div class="dlg__b">
              @if (bodyPiece(); as b) {
                <ng-container *ngComponentOutlet="b.component; inputs: b.inputs ?? {}" />
              } @else {
                <p>{{ d.body }}</p>
              }
            </div>
          }
          <div class="dlg__act">
            <button class="btn btn--ghost" type="button" data-testid="confirm-cancel" (click)="close(false)">{{ d.cancel ?? '取消' }}</button>
            <button #ok [class]="'btn btn--' + (d.tone ?? 'primary')" type="button" data-testid="confirm-ok" (click)="close(true)">
              {{ d.confirm ?? '确定' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DialogHostComponent {
  protected readonly feedback = inject(FeedbackStore);
  protected readonly shown = signal(false);
  /** 正文是组件时给出它；是一段文字时为 null */
  protected readonly bodyPiece = computed(() => {
    const b = this.feedback.dialog()?.body;
    return b && typeof b !== 'string' ? b : null;
  });
  private readonly ok = viewChild<ElementRef<HTMLButtonElement>>('ok');
  private prevFocus: HTMLElement | null = null;

  constructor() {
    effect((onCleanup) => {
      if (!this.feedback.dialog()) return;
      untracked(() => {
        this.prevFocus = document.activeElement as HTMLElement | null;
        // 两帧之后再加 is-in，入场过渡才会生效
        const raf = requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            this.shown.set(true);
            this.ok()?.nativeElement.focus();
          }),
        );
        onCleanup(() => cancelAnimationFrame(raf));
      });
    });
  }

  protected close(ok: boolean) {
    const d = this.feedback.dialog();
    if (!d) return;
    this.shown.set(false);
    this.prevFocus?.focus?.();
    d.resolve(ok);
  }

  /** 焦点圈定：Tab 在卡片内循环 */
  protected trap(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button, a[href], input, textarea');
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
}
