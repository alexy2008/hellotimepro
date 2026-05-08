import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CapsuleStore } from '@/stores/capsule.store';
import { CapsuleGridComponent } from '@/components/capsule-grid/capsule-grid.component';
import { PaginationComponent } from '@/components/pagination/pagination.component';

@Component({
  selector: 'app-me-favorites',
  standalone: true,
  imports: [RouterLink, CapsuleGridComponent, PaginationComponent],
  template: `
    <h1>我收藏的胶囊</h1>
    <p style="color:var(--color-text-secondary);margin:0 0 var(--space-6)">
      共 {{ capsule.favorites().pagination?.total ?? 0 }} 条；取消收藏只会从此列表移除，不会影响原胶囊。
    </p>

    <app-capsule-grid
      [items]="capsule.favorites().items"
      [loading]="capsule.favorites().loading">
      <div empty class="cy-empty">
        <div class="cy-empty__emoji">🗂</div>
        <p>还没有收藏任何胶囊 —— 去广场看看？</p>
        <a routerLink="/" class="cy-btn cy-btn--ghost cy-btn--sm" style="margin-top:var(--space-3)">去广场</a>
      </div>
    </app-capsule-grid>

    <app-pagination
      [page]="capsule.favorites().page"
      [totalPages]="capsule.favorites().pagination?.totalPages ?? 0"
      (onChange)="capsule.fetchFavorites($event)" />
  `,
})
export class MeFavoritesComponent implements OnInit {
  capsule = inject(CapsuleStore);

  ngOnInit() { void this.capsule.fetchFavorites(1); }
}
