import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { PlazaStore } from '@/stores/plaza.store';
import type { PlazaFilter, PlazaSort } from '@/types';

const SORTS: { key: PlazaSort; label: string }[] = [
  { key: 'hot', label: '🔥 热门' },
  { key: 'new', label: '✨ 最新' },
];
const FILTERS: { key: PlazaFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'opened', label: '已开启' },
  { key: 'unopened', label: '未开启' },
];

@Component({
  selector: 'app-plaza-toolbar',
  standalone: true,
  template: `
    <div class="cy-toolbar">
      <div class="cy-toolbar__group">
        <div class="cy-seg">
          @for (s of sorts; track s.key) {
            <button type="button"
              [class]="s.key === plaza.sort() ? 'cy-seg__active' : ''"
              (click)="plaza.setSort(s.key)">{{ s.label }}</button>
          }
        </div>
        <div class="cy-seg">
          @for (f of filters; track f.key) {
            <button type="button"
              [class]="f.key === plaza.filter() ? 'cy-seg__active' : ''"
              (click)="plaza.setFilter(f.key)">{{ f.label }}</button>
          }
        </div>
      </div>
      <label class="cy-search" aria-label="搜索胶囊">
        <span class="cy-search__icon" aria-hidden="true">🔍</span>
        <input type="search" class="cy-search__input" placeholder="搜索标题或昵称…" maxlength="50"
          [value]="draft()"
          (input)="onDraftChange($event)" />
      </label>
    </div>
  `,
})
export class PlazaToolbarComponent implements OnInit, OnDestroy {
  plaza = inject(PlazaStore);
  sorts = SORTS;
  filters = FILTERS;
  draft = signal('');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.draft.set(this.plaza.q());
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  onDraftChange(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.draft.set(v);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (v !== this.plaza.q()) this.plaza.setQ(v);
    }, 300);
  }
}
