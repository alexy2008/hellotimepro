// ============================================================
// 「时笺」胶囊详情（/capsules/:code）
// 三种形态：未启封（信封 + 翻页倒计时 + 刻度尺）→ 启封动画 → 已启封（信笺）
// 结构与类名照 2.0 原型 paper/view-capsule.js；取数与「等服务端确认开启」在 CapsuleFacade
// ============================================================

import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapsuleFacade } from '@/pages/capsule/capsule.facade';
import { FeedbackStore } from '@/stores/feedback.store';
import { reducedMotion, sleep } from '@/lib/fmt';
import { IconDirective } from '@/shared/icon.directive';
import { CONTENTS } from '@/shared/host';
import { PaperSealComponent } from '../parts/seal.component';
import type { Opening } from '../parts/art';
import { PaperLetterComponent } from './letter.component';
import { PaperSealedComponent } from './sealed.component';

@Component({
  selector: 'app-paper-capsule',
  imports: [RouterLink, IconDirective, PaperSealComponent, PaperLetterComponent, PaperSealedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = f.capsule();
    <div class="page page--detail">
      <div
        [class]="'wrap wrap--narrow detail ' + host()"
        [attr.data-testid]="cap ? 'capsule-detail' : null"
        [attr.data-code]="cap?.code ?? null"
        [attr.data-state]="cap ? (opened() ? 'opened' : 'sealed') : null"
        [attr.data-in-plaza]="cap ? cap.inPlaza : null"
      >
        @if (f.status() === 'error') {
          <div class="lost" role="alert">
            <p>暂时无法加载这枚胶囊，请稍后重试。</p>
            <button class="btn btn--ghost" type="button" (click)="f.load()">重试</button>
          </div>
        } @else if (f.status() === 'missing') {
          <div class="lost" data-testid="detail-not-found">
            <div class="lost__mark"><span appPaperSeal ch="无" variant="line"></span></div>
            <h1 class="h1">查无此信</h1>
            <p>
              @if (f.code()) {
                没有找到胶囊码为 <b class="mono">{{ f.code().toUpperCase() }}</b> 的胶囊。
              } @else {
                这枚胶囊不存在。
              }
              <br />它也可能已经被作者删除了。
            </p>
            <div class="lost__act">
              <a class="btn btn--primary" routerLink="/open"><svg appIcon="key"></svg>重新输入胶囊码</a>
              <a class="btn btn--ghost" routerLink="/">回到广场</a>
            </div>
          </div>
        } @else if (cap) {
          @if (opened()) {
            <app-paper-letter [c]="cap" [reveal]="reveal()" />
          } @else {
            <app-paper-sealed [c]="cap" [now]="f.now()" [opening]="opening()" />
          }
        }
      </div>
    </div>
  `,
})
export class PaperCapsuleComponent {
  protected readonly f = inject(CapsuleFacade);
  private readonly feedback = inject(FeedbackStore);
  protected readonly opening = signal<Opening | null>(null);
  protected readonly host = signal('');
  protected readonly reveal = signal(false);
  protected readonly opened = computed(() => !!this.f.capsule()?.isOpened && !this.opening());

  constructor() {
    let openingTask: AbortController | undefined;
    inject(DestroyRef).onDestroy(() => openingTask?.abort());
    let lastCode = '';
    effect(() => {
      const code = this.f.code();
      const expired = this.f.expired();
      untracked(() => {
        if (code !== lastCode) {
          lastCode = code;
          openingTask?.abort();
          openingTask = undefined;
          this.reveal.set(false);
          this.opening.set(null);
          this.host.set('');
        }
        if (!expired || openingTask || this.f.capsule()?.code !== code.toUpperCase()) return;
        openingTask = new AbortController();
        void this.open(openingTask.signal);
      });
    });
  }

  /** 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影 */
  private async open(signal: AbortSignal) {
    this.opening.set({ crack: 'whole', open: false, rising: false });
    this.host.set('is-opening');
    if (!reducedMotion()) {
      this.opening.set({ crack: 'split', open: false, rising: false });
      await sleep(60);
      if (signal.aborted) return;
      this.opening.set({ crack: 'cracked', open: false, rising: false });
      await sleep(620);
      if (signal.aborted) return;
      this.opening.set({ crack: 'cracked', open: true, rising: false });
      await sleep(760);
      if (signal.aborted) return;
      this.opening.set({ crack: 'cracked', open: true, rising: true });
      await sleep(900);
      if (signal.aborted) return;
      this.host.set('is-opening is-leaving');
      await sleep(380);
      if (signal.aborted) return;
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await this.f.awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
    this.host.set('');
    this.opening.set(null);
    this.reveal.set(true);
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    this.feedback.toast('胶囊已启封');
  }
}
