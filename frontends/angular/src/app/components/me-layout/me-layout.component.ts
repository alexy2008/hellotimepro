import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppHeaderComponent } from '@/components/app-header/app-header.component';
import { AppFooterComponent } from '@/components/app-footer/app-footer.component';
import { AuthStore } from '@/stores/auth.store';

@Component({
  selector: 'app-me-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppHeaderComponent, AppFooterComponent],
  template: `
    <app-header />
    <main class="cy-container">
      <div class="cy-me">
        <aside class="cy-me__nav">
          <a routerLink="/me/created" routerLinkActive="is-active">📝 我创建的</a>
          <a routerLink="/me/favorites" routerLinkActive="is-active">♥ 我收藏的</a>
          <a routerLink="/me/profile" routerLinkActive="is-active">⚙ 账号设置</a>
          <span style="border-top:1px solid var(--color-border-subtle);margin:var(--space-3) 0"></span>
          <a href="/login" style="color:var(--color-danger-fg)" (click)="doLogout($event)">登出</a>
        </aside>
        <section class="cy-me__content">
          <router-outlet />
        </section>
      </div>
    </main>
    <app-footer />
  `,
})
export class MeLayoutComponent {
  private auth = inject(AuthStore);

  async doLogout(e: Event) {
    e.preventDefault();
    await this.auth.logout();
    window.location.assign('/');
  }
}
