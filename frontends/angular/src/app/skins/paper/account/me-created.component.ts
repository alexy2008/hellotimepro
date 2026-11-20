// 「我创建的」：一本账簿，每行一枚胶囊（含删除）
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CapsuleListItem } from '@/types';
import { fmt, ms, pad2 } from '@/lib/fmt';
import { injectMyList } from '@/pages/me/my-list';
import { MeFacade } from '@/pages/me/me.facade';
import { ShareService } from '@/shared/share.service';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { ListMoreComponent } from '@/shared/list-more.component';
import { DialogMarkComponent } from '@/shared/dialog-mark.component';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperScaleComponent } from '../parts/scale.component';
import { PaperSealComponent } from '../parts/seal.component';

@Component({
  selector: 'app-paper-me-created',
  imports: [RouterLink, IconDirective, CreateLinkDirective, ListMoreComponent, FmtPipe, PaperScaleComponent, PaperSealComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (list.items(); as items) {
      @if (!items.length) {
        <div class="empty empty--inline" data-testid="list-empty">
          <span appPaperSeal ch="空" variant="line"></span>
          <h3>还没有写下任何胶囊</h3>
          <p>第一封信，写给一年后的自己怎么样？</p>
          <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>写一枚胶囊</a>
        </div>
      } @else {
        <div class="me__bar">
          <span>按创建时间倒序 · 共 {{ list.total() }} 枚</span>
          <a appCreateLink class="btn btn--primary btn--sm"><svg appIcon="plus"></svg>新建胶囊</a>
        </div>
        <ul class="ledger">
          @for (c of items; track c.id; let i = $index) {
            @let r = row(c);
            <li class="ledger__row" [style.--i]="i" data-testid="my-capsule" [attr.data-code]="c.code" [attr.data-state]="r.opened ? 'opened' : 'sealed'" [attr.data-in-plaza]="c.inPlaza">
              <div class="ledger__seal"><span appPaperSeal [ch]="r.opened ? '启' : '封'" [variant]="r.opened ? 'line' : 'solid'"></span></div>
              <div class="ledger__main">
                <a class="ledger__title serif" [routerLink]="'/capsules/' + c.code" data-testid="row-open">{{ c.title }}</a>
                <div class="ledger__sub">
                  <button class="ledger__code mono" type="button" title="点击复制胶囊码" (click)="share.copyCode(c.code)">{{ c.code }}<svg appIcon="copy"></svg></button>
                  @if (c.inPlaza) {
                    <span class="tag"><svg appIcon="globe"></svg>广场公开</span>
                  } @else {
                    <span class="tag tag--quiet"><svg appIcon="lock"></svg>仅凭码可见</span>
                  }
                  <span>封存于 {{ r.createdAt | fmt: 'date' }}</span>
                </div>
              </div>
              @if (r.opened) {
                <div class="ledger__when">
                  <span class="ledger__k">已启封</span><b>{{ r.openAt | fmt: 'date' }}</b><small>在途 {{ r.openAt - r.createdAt | fmt: 'span' }}</small>
                </div>
              } @else {
                <div class="ledger__when">
                  <span class="ledger__k">距启封</span>
                  <b>
                    @if (r.days > 0) {
                      <span class="latin">{{ r.days | fmt: 'num' }}</span> 天
                    } @else {
                      <span class="mono">{{ r.hms }}</span>
                    }
                  </b>
                  <div appPaperScale [p]="r.progress"></div>
                </div>
              }
              <div class="ledger__fav" [title]="'被收藏 ' + c.favoriteCount + ' 次'"><svg appIcon="heart"></svg><span class="latin">{{ c.favoriteCount | fmt: 'num' }}</span></div>
              <div class="ledger__act">
                <a class="btn btn--text" [routerLink]="'/capsules/' + c.code">查看</a>
                <button class="btn btn--text btn--danger" type="button" data-testid="delete-capsule" (click)="remove(c)">删除</button>
              </div>
            </li>
          }
        </ul>
        <app-list-more [show]="list.hasMore()" [busy]="list.moreBusy()" [left]="list.left()" (more)="list.loadMore()" />
        <p class="me__fine"><svg appIcon="info"></svg>胶囊的内容与启封时刻一经封存就不可修改；你可以随时删除自己写的胶囊，无论它是否已经启封。</p>
      }
    }
  `,
})
export class PaperMeCreatedComponent {
  readonly now = input.required<number>();
  private readonly me = inject(MeFacade);
  protected readonly share = inject(ShareService);
  protected readonly list = injectMyList('created', () => this.me.refresh());

  protected row(c: CapsuleListItem) {
    const openAt = ms(c.openAt);
    const createdAt = ms(c.createdAt);
    const cd = fmt.cd(openAt, this.now());
    return {
      openAt,
      createdAt,
      opened: c.isOpened || openAt <= this.now(),
      days: cd.d,
      hms: `${pad2(cd.h)}:${pad2(cd.m)}:${pad2(cd.s)}`,
      progress: fmt.progress(createdAt, openAt, this.now()),
    };
  }

  /** 删除确认框顶上盖一枚「删」字朱文印 */
  protected remove(c: CapsuleListItem) {
    void this.list.remove(c, { component: DialogMarkComponent, inputs: { ch: '删', icon: 'trash' } });
  }
}
