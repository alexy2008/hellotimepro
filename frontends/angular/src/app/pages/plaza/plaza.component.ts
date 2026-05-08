import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlazaStore } from '@/stores/plaza.store';
import { AuthStore } from '@/stores/auth.store';
import { PlazaToolbarComponent } from '@/components/plaza-toolbar/plaza-toolbar.component';
import { CapsuleGridComponent } from '@/components/capsule-grid/capsule-grid.component';
import { PaginationComponent } from '@/components/pagination/pagination.component';
import { fmtNumber } from '@/utils/format';

@Component({
  selector: 'app-plaza',
  standalone: true,
  imports: [RouterLink, PlazaToolbarComponent, CapsuleGridComponent, PaginationComponent],
  template: `
    <section class="cy-hero-block">
      <div class="cy-container">
        <h1 class="cy-hero-title">封存此刻 <span class="cy-hero-title__highlight">开启未来</span></h1>
        <p class="cy-hero-subtitle">
          写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
        </p>
        <div class="cy-hero-cta">
          <a [routerLink]="auth.user() ? '/create' : '/register'" class="cy-btn cy-btn--primary cy-btn--hero">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
            </svg>
            创建我的胶囊
          </a>
          <a routerLink="/open" class="cy-btn cy-btn--success cy-btn--hero">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
            用胶囊码开启
          </a>
        </div>
      </div>
    </section>

    <main class="cy-container">
      <app-plaza-toolbar />
      <app-capsule-grid [items]="plaza.items()" [loading]="plaza.loading()">
        <div empty class="cy-empty">
          <div class="cy-empty__emoji">🌌</div>
          <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
          <a [routerLink]="auth.user() ? '/create' : '/register'"
            class="cy-btn cy-btn--primary cy-btn--sm" style="margin-top:var(--space-3)">
            {{ auth.user() ? '创建胶囊' : '注册并创建' }}
          </a>
        </div>
      </app-capsule-grid>
      <app-pagination
        [page]="plaza.page()"
        [totalPages]="plaza.pagination()?.totalPages ?? 0"
        [extra]="plaza.pagination() ? '共 ' + fmtNumber(plaza.pagination()!.total) + ' 条' : undefined"
        (onChange)="plaza.setPage($event)"
        margin="var(--space-10) 0 var(--space-6)" />
    </main>
  `,
})
export class PlazaComponent implements OnInit {
  plaza = inject(PlazaStore);
  auth = inject(AuthStore);
  fmtNumber = fmtNumber;

  ngOnInit() {
    if (this.auth.hydrated()) void this.plaza.fetch();
  }
}
