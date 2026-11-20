// 「我创建的」：每行一枚专属配色的胶囊（含删除）
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleListItem } from '@/types';
import { fmt, ms } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { injectMyList } from '@/pages/me/my-list';
import { MeFacade } from '@/pages/me/me.facade';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { ListMoreComponent } from '@/shared/list-more.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberBadgeComponent, AmberVisBadgeComponent } from '../parts/badge.component';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberEmptyComponent } from '../parts/empty.component';
import { cdShort } from '../parts/art';
import { AmberDeleteMarkComponent } from './delete-mark.component';

@Component({
  selector: 'app-amber-me-created',
  imports: [RouterLink, IconDirective, CreateLinkDirective, ListMoreComponent, FmtPipe, AmberBadgeComponent, AmberVisBadgeComponent, AmberCapsuleArtComponent, AmberEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (list.items(); as items) {
      @if (!items.length) {
        <div appAmberEmpty heading="还没有写下任何胶囊" text="第一枚，写给一年后的自己怎么样？">
          <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>写一枚胶囊</a>
        </div>
      } @else {
        <div class="me__sub">
          <span>按创建时间倒序 · 共 {{ list.total() }} 枚</span>
          <a appCreateLink class="btn btn--primary btn--sm"><svg appIcon="plus"></svg>写一枚</a>
        </div>
        <ul class="ledger">
          @for (c of items; track c.id; let i = $index) {
            @let r = row(c);
            <li class="ledger__row" [style.--i]="i" [style.--glow]="r.glow" data-testid="my-capsule" [attr.data-code]="c.code" [attr.data-state]="r.opened ? 'opened' : 'sealed'" [attr.data-in-plaza]="c.inPlaza">
              <a class="ledger__art" [routerLink]="'/capsules/' + c.code" tabindex="-1" aria-hidden="true"><svg appAmberCapsuleArt [code]="c.code" [state]="r.opened ? 'opened' : 'locked'" [width]="112"></svg></a>
              <div class="ledger__main">
                <a class="ledger__title" [routerLink]="'/capsules/' + c.code" data-testid="row-open">{{ c.title }}</a>
                <div class="ledger__sub">
                  <button class="ledger__code mono" type="button" title="点击复制胶囊码" (click)="share.copyCode(c.code)">{{ c.code }}<svg appIcon="copy"></svg></button>
                  <span appAmberVisBadge [inPlaza]="c.inPlaza"></span>
                  <span>封存于 {{ r.createdAt | fmt: 'date' }}</span>
                </div>
              </div>
              <div class="ledger__when">
                @if (r.opened) {
                  <span appAmberBadge kind="opened" icon="mail">已开启</span><span>{{ r.openAt | fmt: 'date' }} · 沉睡 {{ r.openAt - r.createdAt | fmt: 'span' }}</span>
                } @else {
                  <span class="ledger__cd"><svg appIcon="hourglass"></svg><b class="mono">{{ r.cd }}</b></span>
                  <div class="pc__progress"><span [style.width.%]="r.progress"></span></div>
                }
              </div>
              <div class="ledger__fav" [title]="'被收藏 ' + c.favoriteCount + ' 次'"><svg appIcon="heart"></svg><span class="mono">{{ c.favoriteCount | fmt: 'num' }}</span></div>
              <div class="ledger__act">
                <a class="btn btn--ghost btn--sm" [routerLink]="'/capsules/' + c.code">查看</a>
                <button class="btn btn--danger-ghost btn--sm" type="button" data-testid="delete-capsule" (click)="remove(c)">删除</button>
              </div>
            </li>
          }
        </ul>
        <app-list-more [show]="list.hasMore()" [busy]="list.moreBusy()" [left]="list.left()" (more)="list.loadMore()" />
        <p class="tip tip--quiet"><svg appIcon="info"></svg><span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span></p>
      }
    }
  `,
})
export class AmberMeCreatedComponent {
  readonly now = input.required<number>();
  private readonly me = inject(MeFacade);
  protected readonly share = inject(ShareService);
  protected readonly list = injectMyList('created', () => this.me.refresh());

  protected row(c: CapsuleListItem) {
    const openAt = ms(c.openAt);
    const createdAt = ms(c.createdAt);
    return {
      openAt,
      createdAt,
      opened: c.isOpened || openAt <= this.now(),
      glow: paletteOf(c.code).glow,
      cd: cdShort(openAt, this.now()),
      progress: Math.max(2, fmt.progress(createdAt, openAt, this.now())),
    };
  }

  /** 删除确认框顶上放这枚胶囊的插画 */
  protected remove(c: CapsuleListItem) {
    void this.list.remove(c, { component: AmberDeleteMarkComponent, inputs: { code: c.code } });
  }
}
