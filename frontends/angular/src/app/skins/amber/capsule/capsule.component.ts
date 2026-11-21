// ============================================================
// 「琥珀」胶囊详情（/capsules/:code）
// 一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
// 结构与类名照 2.0 原型 amber/view-capsule.js；取数与「等服务端确认开启」在 CapsuleFacade
// ============================================================

import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapsuleFacade } from '@/pages/capsule/capsule.facade';
import { FeedbackStore } from '@/stores/feedback.store';
import { reducedMotion, sleep } from '@/lib/fmt';
import { IconDirective } from '@/shared/icon.directive';
import { CONTENTS } from '@/shared/host';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberLetterComponent } from './letter.component';
import { AmberLockedComponent } from './locked.component';

@Component({
  selector: 'app-amber-capsule',
  imports: [RouterLink, IconDirective, AmberCapsuleArtComponent, AmberLetterComponent, AmberLockedComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let cap = f.capsule();
    <div class="page page--detail">
      <div
        class="container detail"
        [attr.data-testid]="cap ? 'capsule-detail' : null"
        [attr.data-code]="cap?.code ?? null"
        [attr.data-state]="cap ? (opened() ? 'opened' : 'sealed') : null"
        [attr.data-in-plaza]="cap ? cap.inPlaza : null"
      >
        @if (f.status() === 'error') {
          <div class="notice card" role="alert">
            <p>暂时无法加载这枚胶囊，请稍后重试。</p>
            <button class="btn btn--ghost" type="button" (click)="f.load()">重试</button>
          </div>
        } @else if (f.status() === 'missing') {
          <div class="notice card" data-testid="detail-not-found">
            <svg appAmberCapsuleArt code="LOST0000" state="opened" [width]="200" class="notice__art"></svg>
            <div class="eyebrow">Not found</div>
            <h1 class="page-title">找不到这枚胶囊</h1>
            <p class="page-lead">
              @if (f.code()) {
                没有胶囊码为 <b class="mono">{{ f.code().toUpperCase() }}</b> 的胶囊。
              } @else {
                这枚胶囊不存在。
              }
              也许是码抄错了一位，也许它已经被作者删除了。
            </p>
            <div class="notice__act">
              <a class="btn btn--primary" routerLink="/open"><svg appIcon="key"></svg>重新输入胶囊码</a>
              <a class="btn btn--ghost" routerLink="/">回到广场</a>
            </div>
          </div>
        } @else if (cap) {
          @if (phase()) {
            <div class="opening" [class.is-open]="phase() === 'open'">
              <div class="opening__burst"></div>
              <div class="opening__capsule"><svg appAmberCapsuleArt [code]="cap.code" [state]="phase() === 'open' ? 'opened' : 'locked'" [width]="300"></svg></div>
              <p class="opening__text">时间到了，正在开启……</p>
            </div>
          } @else if (opened()) {
            <app-amber-letter [c]="cap" [reveal]="reveal()" />
          } @else {
            <app-amber-locked [c]="cap" [now]="f.now()" />
          }
        }
      </div>
    </div>
  `,
})
export class AmberCapsuleComponent {
  protected readonly f = inject(CapsuleFacade);
  private readonly feedback = inject(FeedbackStore);
  protected readonly phase = signal<'' | 'shaking' | 'open'>('');
  protected readonly reveal = signal(false);
  protected readonly opened = computed(() => !!this.f.capsule()?.isOpened && !this.phase());

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
          this.phase.set('');
        }
        if (!expired || openingTask || this.f.capsule()?.code !== code.toUpperCase()) return;
        openingTask = new AbortController();
        void this.open(openingTask.signal);
      });
    });
  }

  /** 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上 */
  private async open(signal: AbortSignal) {
    if (!reducedMotion()) {
      this.phase.set('shaking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await sleep(820);
      if (signal.aborted) return;
      this.phase.set('open');
      await sleep(1150);
      if (signal.aborted) return;
    }
    // 以服务端确认开启为准：没确认前停在动画末帧，不提前报「已开启」
    if (!(await this.f.awaitOpened(signal)) || signal.aborted) return; // 离开了页面，或胶囊已被删除
    this.phase.set('');
    this.reveal.set(true);
    this.feedback.toast('胶囊已开启');
  }
}
