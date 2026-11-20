// 详情页底部：收藏 · 复制胶囊码 · 分享链接
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { CapsuleDetail } from '@/types';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { FavButtonComponent } from '@/shared/fav-button.component';

@Component({
  selector: 'div[appPaperDetailActions]',
  imports: [IconDirective, FavButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'detail__actions' },
  template: `
    <app-fav-button [capsule]="c()" size="md" />
    <button class="btn btn--ghost" type="button" data-testid="copy-code" (click)="share.copyCode(c().code)"><svg appIcon="copy"></svg>复制胶囊码</button>
    <button class="btn btn--ghost" type="button" data-testid="copy-link" (click)="share.copyLink(c().code)"><svg appIcon="link"></svg>分享链接</button>
  `,
})
export class PaperDetailActionsComponent {
  readonly c = input.required<CapsuleDetail>();
  protected readonly share = inject(ShareService);
}
