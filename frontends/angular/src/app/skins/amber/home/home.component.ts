// ============================================================
// 「琥珀」首页 = 主视觉 + 年鉴 + 胶囊广场（/）
// 主视觉：「把此刻，寄给未来。」+ 两个入口 + 就地输码 + 时间表盘 + 精选凭条
// 结构与类名照 2.0 原型 amber/view-plaza.js；逻辑在 HomeFacade 与 PlazaStore
// ============================================================

import { ChangeDetectionStrategy, Component, computed, type ElementRef, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeFacade, pageNumbers, scrollToPlaza } from '@/pages/home/home.facade';
import type { PlazaFilter, PlazaSort } from '@/types';
import { ms } from '@/lib/fmt';
import { paletteOf } from '@/lib/palette';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { SegComponent, type SegOption } from '@/shared/seg.component';
import { SlashFocusDirective } from '@/shared/slash-focus.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { AmberCapsuleArtComponent } from '../parts/capsule-art.component';
import { AmberCardComponent, AmberCardSkeletonComponent } from '../parts/card.component';
import { AmberEmptyComponent } from '../parts/empty.component';
import { cdShort } from '../parts/art';
import { AmberHeroArtComponent } from './hero-art.component';
import { AmberQuickOpenComponent } from './quick-open.component';

@Component({
  selector: 'app-amber-home',
  imports: [
    RouterLink,
    IconDirective,
    CreateLinkDirective,
    SegComponent,
    SlashFocusDirective,
    FmtPipe,
    AmberCapsuleArtComponent,
    AmberCardComponent,
    AmberCardSkeletonComponent,
    AmberEmptyComponent,
    AmberHeroArtComponent,
    AmberQuickOpenComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let p = plaza.pagination();
    @let term = plaza.q().trim();
    <div class="page page--home">
      <section class="hero container">
        <div class="hero__copy">
          <div class="eyebrow">HelloTime Pro · 时间胶囊</div>
          <h1 class="hero__title">
            <span class="hero__line">把此刻，</span>
            <span class="hero__line">寄给<em class="hero__future">未来</em>。</span>
          </h1>
          <p class="hero__lede">写下一段话，选定一个未来的时刻，把它封进胶囊。<br />在那之前，谁也读不到——包括你自己。</p>
          <div class="hero__cta">
            <a appCreateLink class="btn btn--primary btn--lg" data-testid="home-create"><svg appIcon="pen"></svg>写一枚胶囊</a>
            <a class="btn btn--ghost btn--lg" href="#plaza" (click)="toPlaza($event)">逛逛胶囊广场<svg appIcon="arrow" class="ic--go"></svg></a>
          </div>
          <form appAmberQuickOpen></form>
          <div class="hero__now"><span class="hero__live"></span>此刻 · <span class="mono">{{ h.now() | fmt: 'dash' }} {{ h.now() | fmt: 'timeSec' }}</span></div>
        </div>
        <div class="hero__art">
          <div appAmberHeroArt></div>
          @if (plaza.featured(); as f) {
            <a class="slip" [routerLink]="'/capsules/' + f.code" [style.--glow]="glowOf(f.code)">
              <div class="slip__k"><span class="slip__dot"></span>广场上最受期待的一枚</div>
              <div class="slip__row">
                <svg appAmberCapsuleArt [code]="f.code" state="locked" [width]="64"></svg>
                <div><b class="slip__t">{{ f.title }}</b><span class="slip__cd mono">{{ cdOf(f.openAt) }}</span></div>
              </div>
              <div class="slip__f"><svg appIcon="heart"></svg>{{ f.favoriteCount | fmt: 'num' }} 人在等它</div>
            </a>
          }
        </div>
      </section>

      <section class="container stats" aria-label="广场概览" data-testid="plaza-stats">
        @for (s of stats(); track s.k; let i = $index) {
          <div class="stats__cell" [style.--i]="i" data-testid="stat" [attr.data-key]="s.k" [attr.data-value]="s.n">
            <b class="mono">{{ s.n }}</b><span>{{ s.a }}<br />{{ s.b }}</span>
          </div>
        }
      </section>

      <section class="container plaza" id="plaza">
        <header class="page-head page-head--split">
          <div>
            <div class="eyebrow">Capsule Plaza</div>
            <h2 class="page-title">胶囊广场</h2>
            <p class="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
          </div>
          <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>我也放一枚</a>
        </header>

        <div class="toolbar card">
          <label class="search input-wrap" [class.has-value]="!!plaza.qInput()">
            <svg appIcon="search" class="input-wrap__icon"></svg>
            <input
              #search
              appSlashFocus
              class="input"
              type="search"
              placeholder="搜索标题或昵称…"
              maxlength="50"
              autocomplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              [value]="plaza.qInput()"
              (input)="plaza.typeQ(search.value)"
              (keydown.escape)="plaza.typeQ(''); search.blur()"
            />
            <kbd class="kbd">/</kbd>
            <button class="search__x icon-btn" type="button" aria-label="清空搜索" (click)="clearSearch()"><svg appIcon="x"></svg></button>
          </label>
          <app-seg label="筛选" testid="filter-option" [options]="filterOptions()" [value]="plaza.filter()" (valueChange)="plaza.setFilter($event)" />
          <div class="select">
            <select #sortSel aria-label="排序" data-testid="plaza-sort" [value]="plaza.sort()" (change)="setSort(sortSel.value)">
              <option value="new">最新封存</option>
              <option value="hot">最多收藏</option>
            </select>
            <svg appIcon="chev-down" class="select__arrow"></svg>
          </div>
        </div>

        <div class="plaza__count">
          @if (p) {
            共 <b>{{ p.total | fmt: 'num' }}</b> 枚胶囊{{ term ? ' · 关键词「' + term + '」' : '' }}
          }
        </div>

        <div class="grid" [class.is-busy]="plaza.loading() && !!p" aria-live="polite">
          @if (plaza.loading() && !p) {
            @for (i of skeletons; track i) {
              <div appAmberCardSkeleton [i]="i"></div>
            }
          } @else if (plaza.error() && !plaza.items().length) {
            <div appAmberEmpty testid="list-error" heading="广场暂时打不开" text="没能连上后端。请确认服务已启动，或稍后再试。">
              <button class="btn btn--ghost" type="button" data-testid="list-retry" (click)="plaza.refreshAll()"><svg appIcon="refresh"></svg>重试</button>
            </div>
          } @else if (!plaza.items().length && p) {
            @if (term) {
              <div appAmberEmpty [heading]="'没有找到「' + term + '」'" text="换个关键词试试，标题和昵称都可以搜。">
                <button class="btn btn--ghost" type="button" (click)="clearSearch()">清空搜索</button>
              </div>
            } @else {
              <div appAmberEmpty heading="广场上还没有胶囊" text="来当第一个写信给未来的人？">
                <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>写一枚胶囊</a>
              </div>
            }
          } @else {
            @for (c of plaza.items(); track c.id; let i = $index) {
              <article appAmberCard [c]="c" [i]="i" [rank]="h.rankOf(i)" [mine]="h.isMine(c.creator.nickname)" [now]="h.now()"></article>
            }
          }
        </div>

        <nav class="pager" aria-label="分页">
          @if (p && p.totalPages > 1 && plaza.items().length) {
            <button class="pager__btn" type="button" [disabled]="p.page <= 1" aria-label="上一页" (click)="h.goPage(p.page - 1)"><svg appIcon="chev-left"></svg></button>
            @for (n of pages(); track $index) {
              @if (n === '…') {
                <span class="pager__gap">…</span>
              } @else {
                <button class="pager__btn" [class.is-active]="n === p.page" type="button" [attr.aria-current]="n === p.page ? 'page' : null" (click)="h.goPage(n)">{{ n }}</button>
              }
            }
            <button
              class="pager__btn"
              type="button"
              [disabled]="p.page >= p.totalPages"
              aria-label="下一页"
              [attr.data-testid]="p.page < p.totalPages ? 'plaza-next' : null"
              (click)="h.goPage(p.page + 1)"
            ><svg appIcon="chev-right"></svg></button>
          }
        </nav>
      </section>
    </div>
  `,
})
export class AmberHomeComponent {
  protected readonly h = inject(HomeFacade);
  protected readonly plaza = this.h.plaza;
  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
  protected readonly toPlaza = scrollToPlaza;
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly filterOptions = computed<SegOption<PlazaFilter>[]>(() => {
    const c = this.plaza.counts();
    return [
      { value: 'all', label: '全部', count: c?.all },
      { value: 'unopened', label: '封存中', count: c?.unopened },
      { value: 'opened', label: '已开启', count: c?.opened },
    ];
  });
  protected readonly stats = computed(() => {
    const s = this.plaza.overview();
    if (!s) return [];
    const out = [
      { k: 'all', n: s.counts.all, a: '枚胶囊', b: '在广场上' },
      { k: 'unopened', n: s.counts.unopened, a: '枚正在', b: '等待开启' },
      { k: 'opened', n: s.counts.opened, a: '枚已经', b: '被人读到' },
    ];
    if (s.farthestOpenAt) out.push({ k: 'farthestYear', n: new Date(s.farthestOpenAt).getFullYear(), a: '年，最远的', b: '一枚才会打开' });
    return out;
  });
  protected readonly pages = computed(() => {
    const p = this.plaza.pagination();
    return p ? pageNumbers(p.page, p.totalPages) : [];
  });

  protected glowOf(code: string) {
    return paletteOf(code).glow;
  }
  protected cdOf(openAt: string) {
    return cdShort(ms(openAt), this.h.now());
  }
  protected setSort(v: string) {
    this.plaza.setSort(v as PlazaSort);
  }
  protected clearSearch() {
    this.plaza.setQ('');
    this.search().nativeElement.focus();
  }
}
