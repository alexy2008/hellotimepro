import { Component, inject } from '@angular/core';
import { ThemeStore } from '@/stores/theme.store';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button type="button" class="cy-theme-toggle" aria-label="切换主题" (click)="theme.toggle()">
      <span aria-hidden="true">{{ theme.theme() === 'dark' ? '☾' : '☀' }}</span>
    </button>
  `,
})
export class ThemeToggleComponent {
  theme = inject(ThemeStore);
}
