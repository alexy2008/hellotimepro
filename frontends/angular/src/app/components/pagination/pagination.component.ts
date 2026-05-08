import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (alwaysShow() || totalPages() > 1) {
      <div style="display:flex;justify-content:center;align-items:center;gap:var(--space-3);margin:{{ margin() }}">
        <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm"
          [disabled]="page() <= 1" (click)="onChange.emit(page() - 1)">上一页</button>
        <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">
          第 {{ page() }} / {{ totalPages() }} 页{{ extra() ? ' · ' + extra() : '' }}
        </span>
        <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm"
          [disabled]="page() >= totalPages()" (click)="onChange.emit(page() + 1)">下一页</button>
      </div>
    }
  `,
})
export class PaginationComponent {
  page = input.required<number>();
  totalPages = input.required<number>();
  onChange = output<number>();
  extra = input<string | undefined>(undefined);
  alwaysShow = input(false);
  margin = input('var(--space-8) 0');
}
