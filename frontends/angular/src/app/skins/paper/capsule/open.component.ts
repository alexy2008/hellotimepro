// ============================================================
// 「时笺」开启页（/open）：8 格输码 + 粘贴识别；登录后附「我封存过的胶囊」
// 结构与类名照 2.0 原型 paper/view-capsule.js
// ============================================================

import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OpenFacade } from '@/pages/open/open.facade';
import { CodeOpener } from '@/shared/code-opener';
import { FeedbackStore } from '@/stores/feedback.store';
import { ms } from '@/lib/fmt';
import { IconDirective } from '@/shared/icon.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperCodeInputComponent } from '../parts/code-input.component';
import { PaperSealComponent } from '../parts/seal.component';

@Component({
  selector: 'app-paper-open',
  imports: [RouterLink, IconDirective, FmtPipe, PaperCodeInputComponent, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--open">
      <div class="wrap openp">
        <div class="openp__poem" aria-hidden="true"><span>云中谁寄锦书来</span><i></i><small>李清照 ·《一剪梅》</small></div>
        <section class="openp__main">
          <div class="overline"><i></i>Open a capsule</div>
          <h1 class="h1">凭码开启</h1>
          <p class="lede">输入朋友分享给你的 8 位胶囊码。<br />如果还没到启封的时刻，你会看到它的倒计时。</p>

          <app-paper-code-input codeId="code" [state]="code.state()" [shake]="code.shake()" [autofocus]="true" (changed)="code.input($event)" (complete)="code.go($event)" />
          <div class="openp__err" role="alert" [attr.data-testid]="code.error() ? 'open-error' : null">{{ code.error() }}</div>

          <div class="openp__act">
            <button
              class="btn btn--primary btn--lg"
              [class.is-busy]="code.state() === 'checking'"
              type="button"
              [disabled]="code.value().length !== 8 || code.state() === 'checking'"
              (click)="code.go()"
            ><svg appIcon="key"></svg><span>开启</span><svg appIcon="arrow" class="ic--go"></svg></button>
            <button class="btn btn--ghost btn--lg" type="button" (click)="paste()"><svg appIcon="paste"></svg>粘贴识别</button>
          </div>

          <ul class="openp__tips">
            <li><svg appIcon="link"></svg><span>也可以直接访问 <code class="mono">/capsules/&lt;胶囊码&gt;</code></span></li>
            <li><svg appIcon="lock"></svg><span>没有发布到广场的胶囊，同样可以凭码开启</span></li>
          </ul>

          @if (o.auth.user() && o.mine().length) {
            <section class="mylist" data-testid="my-sealed">
              <header>
                <h2 class="serif">我封存过的胶囊</h2>
                <a class="link" routerLink="/me/created">全部<svg appIcon="arrow"></svg></a>
              </header>
              <ul>
                @for (c of o.mine(); track c.id) {
                  <li>
                    <a class="mylist__row" [routerLink]="'/capsules/' + c.code" data-testid="my-sealed-item" [attr.data-code]="c.code" [attr.data-state]="c.isOpened ? 'opened' : 'sealed'">
                      <span appPaperSeal [ch]="c.isOpened ? '启' : '封'" [variant]="c.isOpened ? 'line' : 'solid'"></span>
                      <span class="mylist__info"><b class="serif">{{ c.title }}</b><span class="mono">{{ c.code }}</span></span>
                      <span class="mylist__st">{{ c.isOpened ? '已开启' : '距启封 ' + (left(c.openAt) | fmt: 'span') }}</span>
                      <svg appIcon="chev-right"></svg>
                    </a>
                  </li>
                }
              </ul>
            </section>
          }
        </section>
      </div>
    </div>
  `,
})
export class PaperOpenComponent {
  protected readonly o = inject(OpenFacade);
  protected readonly code = inject(CodeOpener);
  private readonly feedback = inject(FeedbackStore);
  private readonly input = viewChild.required(PaperCodeInputComponent);

  protected left(openAt: string) {
    return ms(openAt) - this.o.now;
  }

  protected async paste() {
    try {
      const t = (await navigator.clipboard.readText()).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!t) return this.feedback.toast('剪贴板里没有胶囊码', { tone: 'info' });
      this.input().set(t);
    } catch {
      this.feedback.toast('粘贴失败：请允许浏览器访问剪贴板', { tone: 'error' });
    }
  }
}
