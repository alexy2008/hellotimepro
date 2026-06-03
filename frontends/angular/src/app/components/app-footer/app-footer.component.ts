import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ApiService } from '@/api/api.service';
import type { HealthData } from '@/types';

const FRONTEND_ITEMS = [
  { role: 'frontend-framework', name: 'Angular', iconUrl: '/static/icons/angular.svg' },
  { role: 'frontend-language', name: 'TypeScript', iconUrl: '/static/icons/typescript.svg' },
  { role: 'frontend-styling', name: 'Tailwind CSS', iconUrl: '/static/icons/tailwindcss.svg' },
];

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="cy-footer">
      <div class="cy-container cy-footer__inner">
        <div style="display:flex;align-items:center;gap:6px">
          © 2026 HelloTime Pro
          <span [class]="dotClass()"
            [title]="connected() === true ? '后端在线' : connected() === false ? '后端离线' : '连接中…'"></span>
        </div>
        <div class="cy-stack">
          @for (it of frontendItems; track it.role) {
            <span class="cy-stack__item" [title]="it.role">
              <img [src]="it.iconUrl" alt="" />{{ it.name }}
            </span>
          }
          @for (it of backendItems(); track it.role + it.name) {
            <span class="cy-stack__item" [title]="it.role">
              @if (it.iconUrl) { <img [src]="it.iconUrl" alt="" /> }
              {{ it.name }}
            </span>
          }
        </div>
      </div>
    </footer>
  `,
})
export class AppFooterComponent implements OnInit {
  private api = inject(ApiService);
  frontendItems = FRONTEND_ITEMS;
  health = signal<HealthData | null>(null);
  connected = signal<boolean | null>(null);

  backendItems = computed(() => this.health()?.stack.items ?? []);

  dotClass() {
    const c = this.connected();
    return c === true ? 'cy-backend-dot cy-backend-dot--online'
      : c === false ? 'cy-backend-dot cy-backend-dot--offline'
      : 'cy-backend-dot';
  }

  ngOnInit() {
    this.api.health()
      .then((h) => { this.health.set(h); this.connected.set(true); })
      .catch(() => this.connected.set(false));
  }
}
