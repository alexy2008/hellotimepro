// ============================================================
// 「琥珀」开启页（/open）：8 格输码；登录后附「我封存过的胶囊」
// 结构与类名照 2.0 原型 amber/view-capsule.js
// ============================================================

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OpenFacade } from '@/pages/open/open.facade';
import { CodeOpener } from '@/shared/code-opener';
import { ms } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { IconDirective } from '@/shared/icon.directive';
import { CONTENTS } from '@/shared/host';
import { AmberBadgeComponent } from '../parts/badge.component';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberCodeInputComponent } from '../parts/code-input.component';
import { cdShort } from '../parts/art';

@Component({
  selector: 'app-amber-open',
  imports: [RouterLink, IconDirective, AmberBadgeComponent, AmberCapsuleArtComponent, AmberCodeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--open">
      <div class="container open">
        <header class="page-head page-head--center">
          <div class="eyebrow">Open a capsule</div>
          <h1 class="page-title">开启胶囊</h1>
          <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
        </header>
        <form class="open__form card" novalidate (submit)="$event.preventDefault(); code.go()">
          <app-amber-code-input size="lg" [state]="code.state()" [shake]="code.shake()" [autofocus]="true" (changed)="code.input($event)" (complete)="code.go($event)" />
          <div class="open__err" role="alert" [attr.data-testid]="code.error() ? 'open-error' : null">{{ code.error() }}</div>
          <button class="btn btn--primary btn--lg" [class.is-busy]="code.state() === 'checking'" type="submit"><svg appIcon="key"></svg>开启胶囊</button>
          <p class="open__hint">
            胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。<br />没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/capsules/胶囊码</code>。
          </p>
        </form>
        @if (o.auth.user() && o.mine().length) {
          <section class="open__list" data-testid="my-sealed">
            <header>
              <h2>我封存过的胶囊</h2>
              <a class="link-btn" routerLink="/me/created">全部<svg appIcon="arrow"></svg></a>
            </header>
            <ul>
              @for (c of o.mine(); track c.id) {
                <li>
                  <a class="crow" [routerLink]="'/capsules/' + c.code" [style.--glow]="glowOf(c.code)" data-testid="my-sealed-item" [attr.data-code]="c.code" [attr.data-state]="c.isOpened ? 'opened' : 'sealed'">
                    <svg appAmberCapsuleArt [code]="c.code" [state]="c.isOpened ? 'opened' : 'locked'" [width]="72"></svg>
                    <span class="crow__info"><b>{{ c.title }}</b><span class="mono">{{ c.code }}</span></span>
                    @if (c.isOpened) {
                      <span appAmberBadge kind="opened" icon="mail">已开启</span>
                    } @else {
                      <span appAmberBadge kind="locked" icon="lock">{{ cdOf(c.openAt) }} 后</span>
                    }
                    <svg appIcon="chev-right" class="crow__go"></svg>
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </div>
  `,
})
export class AmberOpenComponent {
  protected readonly o = inject(OpenFacade);
  protected readonly code = inject(CodeOpener);

  protected glowOf(code: string) {
    return paletteOf(code).glow;
  }
  protected cdOf(openAt: string) {
    return cdShort(ms(openAt), this.o.now);
  }
}
