// 登录 / 注册 共用的左侧题字：两句诗、出处、一枚印、一个邮戳
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FmtPipe } from '@/shared/fmt.pipe';
import { PaperLogoComponent } from '../parts/logo.component';
import { PaperPostmarkComponent } from '../parts/postmark.component';
import { PaperSealComponent } from '../parts/seal.component';

@Component({
  selector: 'aside[appPaperAuthArt]',
  imports: [FmtPipe, PaperLogoComponent, PaperPostmarkComponent, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'auth__art', 'aria-hidden': 'true' },
  template: `
    <div class="auth__brand"><svg appPaperLogo></svg><span class="latin">HelloTime</span></div>
    <div class="auth__poem serif">
      @for (l of poem(); track l) {
        <span>{{ l }}</span>
      }
    </div>
    <div class="auth__foot"><span>{{ src() }}</span><span appPaperSeal [ch]="seal()" class="auth__seal"></span></div>
    <div class="auth__pm"><svg appPaperPostmark [line1]="today | fmt: 'date'" line2="此 刻" class="pm--auth"></svg></div>
  `,
})
export class PaperAuthArtComponent {
  readonly poem = input.required<string[]>();
  readonly src = input.required<string>();
  readonly seal = input.required<string>();
  protected readonly today = Date.now();
}
