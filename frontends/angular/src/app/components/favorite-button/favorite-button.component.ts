import { Component, inject, input, OnChanges, output, signal, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { PlazaStore } from '@/stores/plaza.store';
import { ApiService } from '@/api/api.service';
import { ApiError } from '@/types';

@Component({
  selector: 'app-favorite-button',
  standalone: true,
  template: `
    @if (size() === 'md') {
      <button type="button"
        [class]="'cy-btn cy-btn--accent ' + (active() ? 'is-active' : '')"
        [disabled]="busy()"
        [title]="err() ?? ''"
        (click)="toggle()">
        <span [style.color]="active() ? 'var(--color-favorite-active)' : 'var(--color-favorite-inactive)'">
          {{ active() ? '♥' : '♡' }}
        </span>
        收藏 · {{ count() }}
      </button>
    } @else {
      <button type="button"
        [class]="'cy-capsule__fav ' + (active() ? 'is-active' : '')"
        [disabled]="busy()"
        [title]="err() ?? ''"
        (click)="toggle()">
        {{ active() ? '♥' : '♡' }} {{ count() }}
      </button>
    }
  `,
})
export class FavoriteButtonComponent implements OnChanges {
  capsule = input.required<{ id: string; favoritedByMe: boolean; favoriteCount: number }>();
  size = input<'sm' | 'md'>('sm');
  onChange = output<{ favorited: boolean; count: number }>();

  private auth = inject(AuthStore);
  private router = inject(Router);
  private plaza = inject(PlazaStore);
  private api = inject(ApiService);

  active = signal(false);
  count = signal(0);
  busy = signal(false);
  err = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['capsule']) {
      this.active.set(this.capsule().favoritedByMe);
      this.count.set(this.capsule().favoriteCount);
    }
  }

  async toggle() {
    this.err.set(null);
    if (!this.auth.user()) {
      if (confirm('登录后才能收藏，前往登录？')) this.router.navigate(['/login']);
      return;
    }
    this.busy.set(true);
    try {
      if (this.active()) {
        await this.api.unfavorite(this.capsule().id);
        const next = Math.max(0, this.count() - 1);
        this.active.set(false);
        this.count.set(next);
        this.plaza.patchFavorited(this.capsule().id, false, next);
        this.onChange.emit({ favorited: false, count: next });
      } else {
        const r = await this.api.favorite(this.capsule().id);
        this.active.set(true);
        this.count.set(r.favoriteCount);
        this.plaza.patchFavorited(this.capsule().id, true, r.favoriteCount);
        this.onChange.emit({ favorited: true, count: r.favoriteCount });
      }
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '操作失败');
    } finally {
      this.busy.set(false);
    }
  }
}
