import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="cy-container">
      <div class="cy-empty" style="margin-top:var(--space-16)">
        <div class="cy-empty__emoji">🛰</div>
        <p>这条路径不在时间轴上。</p>
        <a routerLink="/" class="cy-btn cy-btn--ghost cy-btn--sm" style="margin-top:var(--space-3)">回到广场</a>
      </div>
    </main>
  `,
})
export class NotFoundComponent {}
