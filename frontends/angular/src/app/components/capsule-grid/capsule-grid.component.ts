import { Component, input, TemplateRef } from '@angular/core';
import { CapsuleCardComponent } from '@/components/capsule-card/capsule-card.component';
import type { CapsuleListItem } from '@/types';

@Component({
  selector: 'app-capsule-grid',
  standalone: true,
  imports: [CapsuleCardComponent],
  template: `
    @if (loading() && items().length === 0) {
      <div class="cy-empty">
        <div class="cy-empty__emoji">⏳</div>
        <p>加载中…</p>
      </div>
    } @else if (!loading() && items().length === 0) {
      <ng-content select="[empty]" />
    } @else {
      <div class="cy-grid">
        @for (c of items(); track c.id) {
          <app-capsule-card
            [capsule]="c"
            [showCreator]="showCreator()"
            [hideFavorite]="hideFavorite()"
            [rightTemplate]="rightTemplate()" />
        }
      </div>
    }
  `,
})
export class CapsuleGridComponent {
  items = input<CapsuleListItem[]>([]);
  loading = input(false);
  showCreator = input(true);
  hideFavorite = input(false);
  rightTemplate = input<TemplateRef<unknown> | null>(null);
}
