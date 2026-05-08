import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapsuleStore } from '@/stores/capsule.store';
import { CapsuleGridComponent } from '@/components/capsule-grid/capsule-grid.component';
import { PaginationComponent } from '@/components/pagination/pagination.component';
import { fmtNumber } from '@/utils/format';
import type { CapsuleListItem } from '@/types';

@Component({
  selector: 'app-me-created',
  standalone: true,
  imports: [RouterLink, CapsuleGridComponent, PaginationComponent],
  template: `
    <h1>我创建的胶囊</h1>
    <div class="cy-toolbar" style="border-bottom:none;padding-top:0">
      <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">
        按创建时间倒序 · 共 {{ capsule.mine().pagination?.total ?? 0 }} 条
      </span>
      <a routerLink="/create" class="cy-btn cy-btn--primary cy-btn--sm">+ 新建胶囊</a>
    </div>

    <ng-template #rightTpl let-c>
      @if (c.isOpened) {
        <span style="color:var(--color-favorite-active)">♥ {{ fmtNumber(c.favoriteCount) }}</span>
      } @else {
        <button type="button"
          class="cy-btn cy-btn--ghost cy-btn--sm"
          style="min-height:28px;padding:4px 12px;color:var(--color-danger-fg)"
          (click)="withdraw(c)">撤回</button>
      }
    </ng-template>

    <app-capsule-grid
      [items]="capsule.mine().items"
      [loading]="capsule.mine().loading"
      [showCreator]="false"
      [hideFavorite]="true"
      [rightTemplate]="rightTpl">
      <div empty class="cy-empty">
        <div class="cy-empty__emoji">📭</div>
        <p>还没有创建任何胶囊</p>
        <a routerLink="/create" class="cy-btn cy-btn--primary cy-btn--sm" style="margin-top:var(--space-3)">去创建一个</a>
      </div>
    </app-capsule-grid>

    <app-pagination
      [page]="capsule.mine().page"
      [totalPages]="capsule.mine().pagination?.totalPages ?? 0"
      (onChange)="capsule.fetchMine($event)" />
  `,
})
export class MeCreatedComponent implements OnInit {
  @ViewChild('rightTpl') rightTpl!: TemplateRef<{ $implicit: CapsuleListItem }>;
  capsule = inject(CapsuleStore);
  fmtNumber = fmtNumber;

  ngOnInit() { void this.capsule.fetchMine(1); }

  async withdraw(c: CapsuleListItem) {
    if (!confirm('确认撤回？此操作不可恢复。')) return;
    try {
      await this.capsule.deleteCapsule(c.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '撤回失败');
    }
  }
}
