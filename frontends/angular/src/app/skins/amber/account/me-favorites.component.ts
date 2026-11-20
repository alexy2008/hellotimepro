// 「我收藏的」：胶囊卡片网格；在这里取消收藏会从列表里拿掉
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { injectMyList } from '@/pages/me/my-list';
import { MeFacade } from '@/pages/me/me.facade';
import { IconDirective } from '@/shared/icon.directive';
import { ListMoreComponent } from '@/shared/list-more.component';
import { CONTENTS } from '@/shared/host';
import { AmberCardComponent } from '../parts/card.component';
import { AmberEmptyComponent } from '../parts/empty.component';

@Component({
  selector: 'app-amber-me-favorites',
  imports: [RouterLink, IconDirective, ListMoreComponent, AmberCardComponent, AmberEmptyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @if (list.items(); as items) {
      @if (!items.length) {
        <div appAmberEmpty state="locked" heading="还没有收藏" text="去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。">
          <a class="btn btn--primary" routerLink="/">去广场逛逛<svg appIcon="arrow"></svg></a>
        </div>
      } @else {
        <div class="me__sub">
          <span>按收藏时间倒序 · 共 {{ list.total() }} 枚</span>
          <a class="btn btn--ghost btn--sm" routerLink="/">去广场逛逛</a>
        </div>
        <div class="grid">
          @for (c of items; track c.id; let i = $index) {
            <article
              appAmberCard
              [c]="c"
              [i]="i"
              [now]="now()"
              [mine]="auth.user()?.nickname === c.creator.nickname"
              testId="fav-item"
              openTestId="row-open"
              (favChange)="list.onFavChange(c.id, $event)"
            ></article>
          }
        </div>
        <app-list-more [show]="list.hasMore()" [busy]="list.moreBusy()" [left]="list.left()" (more)="list.loadMore()" />
      }
    }
  `,
})
export class AmberMeFavoritesComponent {
  readonly now = input.required<number>();
  protected readonly auth = inject(AuthStore);
  private readonly me = inject(MeFacade);
  protected readonly list = injectMyList('favorites', () => this.me.refresh());
}
