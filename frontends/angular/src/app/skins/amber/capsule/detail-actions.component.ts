// 详情页的按钮组：收藏 · 复制胶囊码 · 分享链接（信笺页另有「我也写一枚」）
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { CapsuleDetail } from '@/types';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { FavButtonComponent } from '@/shared/fav-button.component';

@Component({
  selector: 'div[appAmberDetailActions]',
  imports: [IconDirective, CreateLinkDirective, FavButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'detail__actions' },
  template: `
    <app-fav-button [capsule]="c()" size="md" />
    <button class="btn btn--ghost" type="button" data-testid="copy-code" (click)="share.copyCode(c().code)"><svg appIcon="copy"></svg>复制胶囊码</button>
    <button class="btn btn--ghost" type="button" data-testid="copy-link" (click)="share.copyLink(c().code)"><svg appIcon="link"></svg>分享链接</button>
    @if (letter()) {
      <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>我也写一枚</a>
    }
  `,
})
export class AmberDetailActionsComponent {
  readonly c = input.required<CapsuleDetail>();
  readonly letter = input(false);
  protected readonly share = inject(ShareService);
}
