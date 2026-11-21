// ============================================================
// 「时笺」首页 = 胶囊广场（/）
// Hero（写一枚 + 逛广场 + 就地输码 + 此刻）+ 年鉴 + 工具条 + 信封卡片网格 + 分页
// 结构与类名照 2.0 原型 paper/view-plaza.js；逻辑在 HomeFacade 与 PlazaStore
// ============================================================

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, type ElementRef, inject, viewChild } from '@angular/core';
import { HomeFacade, pageNumbers } from '@/pages/home/home.facade';
import type { PlazaFilter, PlazaSort } from '@/types';
import { IconDirective } from '@/shared/icon.directive';
import { CreateLinkDirective } from '@/shared/create-link.directive';
import { SegComponent, type SegOption } from '@/shared/seg.component';
import { SlashFocusDirective } from '@/shared/slash-focus.directive';
import { FmtPipe } from '@/shared/fmt.pipe';
import { CONTENTS } from '@/shared/host';
import { PaperCardComponent, PaperCardSkeletonComponent } from '../parts/card.component';
import { PaperAlmanacCellComponent } from './almanac-cell.component';
import { PaperHeroComponent } from './hero.component';

const SORT_OPTIONS: SegOption<PlazaSort>[] = [
  { value: 'new', label: '最新', icon: 'clock' },
  { value: 'hot', label: '最热', icon: 'fire' },
];

@Component({
  selector: 'app-paper-home',
  imports: [
    NgTemplateOutlet,
    IconDirective,
    CreateLinkDirective,
    SegComponent,
    SlashFocusDirective,
    FmtPipe,
    PaperCardComponent,
    PaperCardSkeletonComponent,
    PaperAlmanacCellComponent,
    PaperHeroComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let p = plaza.pagination();
    @let term = plaza.q().trim();
    <div class="page page--plaza">
      <section appPaperHero [now]="h.now()" [featured]="plaza.featured()"></section>

      <section class="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
        @if (plaza.overview(); as s) {
          <div appPaperAlmanacCell k="all" [n]="s.counts.all" a="枚胶囊" b="在广场上"></div>
          <div appPaperAlmanacCell k="unopened" [n]="s.counts.unopened" a="枚正在" b="等待启封"></div>
          <div appPaperAlmanacCell k="opened" [n]="s.counts.opened" a="枚已经" b="被人读到"></div>
          @if (farthestYear(); as y) {
            <div appPaperAlmanacCell k="farthestYear" [n]="y" a="年，最远的" b="一枚才会打开" [plain]="true"></div>
          }
        }
      </section>

      <section class="wrap plaza" id="plaza">
        <header class="plaza__head">
          <div>
            <div class="overline"><i></i>Plaza</div>
            <h2 class="h2">胶囊广场</h2>
          </div>
          <p class="plaza__sub">别人写给未来的话。<br />有的已经启封，有的还在路上。</p>
        </header>

        <div class="toolbar">
          <app-seg label="排序" testid="sort-option" [options]="sortOptions" [value]="plaza.sort()" (valueChange)="plaza.setSort($event)" />
          <app-seg label="筛选" testid="filter-option" [options]="filterOptions()" [value]="plaza.filter()" (valueChange)="plaza.setFilter($event)" />
          <label class="search" [class.has-value]="!!plaza.qInput()">
            <svg appIcon="search"></svg>
            <input
              #search
              appSlashFocus
              type="search"
              placeholder="搜索标题或昵称"
              maxlength="50"
              autocomplete="off"
              aria-label="搜索胶囊"
              data-testid="plaza-search"
              [value]="plaza.qInput()"
              (input)="plaza.typeQ(search.value)"
              (keydown.escape)="plaza.typeQ(''); search.blur()"
            />
            <kbd>/</kbd>
            <button class="search__x" type="button" aria-label="清空搜索" (click)="clearSearch()"><svg appIcon="x"></svg></button>
          </label>
        </div>

        <div class="grid" [class.is-busy]="plaza.loading() && !!p" aria-live="polite">
          @if (plaza.loading() && !p) {
            @for (i of skeletons; track i) {
              <div appPaperCardSkeleton [i]="i"></div>
            }
          } @else if (plaza.error()) {
            <div class="empty" data-testid="list-error">
              <ng-container *ngTemplateOutlet="emptyArt" />
              <h3>广场暂时打不开</h3>
              <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
              <button class="btn btn--ghost" type="button" data-testid="list-retry" (click)="plaza.refreshAll()"><svg appIcon="refresh"></svg>重试</button>
            </div>
          } @else if (!plaza.items().length && p) {
            @if (term) {
              <div class="empty" data-testid="list-empty">
                <ng-container *ngTemplateOutlet="emptyArt" />
                <h3>没有找到「{{ term }}」</h3>
                <p>换个关键词试试，标题和昵称都可以搜。</p>
                <button class="btn btn--ghost" type="button" (click)="clearSearch()">清空搜索</button>
              </div>
            } @else {
              <div class="empty" data-testid="list-empty">
                <ng-container *ngTemplateOutlet="emptyArt" />
                <h3>广场上还没有胶囊</h3>
                <p>来当第一个写信给未来的人？</p>
                <a appCreateLink class="btn btn--primary"><svg appIcon="pen"></svg>写一枚胶囊</a>
              </div>
            }
          } @else {
            @for (c of plaza.items(); track c.id; let i = $index) {
              <article appPaperCard [c]="c" [i]="i" [rank]="h.rankOf(i)" [mine]="h.isMine(c.creator.nickname)" [now]="h.now()"></article>
            }
          }
        </div>

        <nav class="pager" aria-label="分页">
          @if (p && plaza.items().length) {
            @if (p.totalPages <= 1) {
              <div class="pager__sum">共 {{ p.total | fmt: 'num' }} 枚</div>
            } @else {
              <button class="pager__nav" type="button" [disabled]="p.page <= 1" (click)="h.goPage(p.page - 1)"><svg appIcon="chev-left"></svg>上一页</button>
              <div class="pager__nums">
                @for (n of pages(); track $index) {
                  @if (n === '…') {
                    <span class="pager__gap">…</span>
                  } @else {
                    <button class="pager__n latin" [class.is-active]="n === p.page" type="button" [attr.aria-current]="n === p.page ? 'page' : null" (click)="h.goPage(n)">
                      {{ n }}
                    </button>
                  }
                }
              </div>
              <button
                class="pager__nav"
                type="button"
                [disabled]="p.page >= p.totalPages"
                [attr.data-testid]="p.page < p.totalPages ? 'plaza-next' : null"
                (click)="h.goPage(p.page + 1)"
              >下一页<svg appIcon="chev-right"></svg></button>
              <div class="pager__sum">共 {{ p.total | fmt: 'num' }} 枚 · 第 {{ p.page }} / {{ p.totalPages }} 页</div>
            }
          }
        </nav>
      </section>
    </div>

    <ng-template #emptyArt>
      <svg class="empty__art" viewBox="0 0 120 84" aria-hidden="true">
        <path d="M8 30 60 6l52 24v46H8z" />
        <path d="M8 30l52 30 52-30" />
        <path d="M34 44V22h52v22" class="empty__art-paper" />
        <path d="M44 30h32M44 37h20" />
      </svg>
    </ng-template>
  `,
})
export class PaperHomeComponent {
  protected readonly h = inject(HomeFacade);
  protected readonly plaza = this.h.plaza;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
  private readonly search = viewChild.required<ElementRef<HTMLInputElement>>('search');

  protected readonly filterOptions = computed<SegOption<PlazaFilter>[]>(() => {
    const c = this.plaza.counts();
    return [
      { value: 'all', label: '全部', count: c?.all },
      { value: 'unopened', label: '未开启', count: c?.unopened },
      { value: 'opened', label: '已开启', count: c?.opened },
    ];
  });
  /** 最远的一枚在哪一年打开；没有时不显示这一格 */
  protected readonly farthestYear = computed(() => {
    const t = this.plaza.overview()?.farthestOpenAt;
    return t ? new Date(t).getFullYear() : null;
  });
  protected readonly pages = computed(() => {
    const p = this.plaza.pagination();
    return p ? pageNumbers(p.page, p.totalPages) : [];
  });

  protected clearSearch() {
    this.plaza.setQ('');
    this.search().nativeElement.focus();
  }
}
