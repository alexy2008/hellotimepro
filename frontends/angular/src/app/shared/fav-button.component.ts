// ============================================================
// 收藏按钮：两套皮肤同一份标记（.fav），卡片与详情页共用。
// - 2.0 起任何胶囊都能收藏（自己的、未公开的都可以）
// - 匿名用户先弹确认框提示登录，确认后带 ?redirect= 去登录
// - 乐观更新：点了立刻变，请求失败再滚回去并提示
// on / count 用 linkedSignal：外部数据变了（列表刷新、另一处收藏）就跟上，本地也能改
// ============================================================

import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { PlazaStore } from '@/stores/plaza.store';
import { FeedbackStore } from '@/stores/feedback.store';
import { LoginPrompt } from '@/core/login-prompt.service';
import { reducedMotion } from '@/lib/fmt';
import { IconDirective } from './icon.directive';
import { FmtPipe } from './fmt.pipe';
import { KeyDirective } from './key.directive';
import { CONTENTS } from './host';

/** 爆开的七粒小点 */
const DOTS = Array.from({ length: 7 }, (_, i) => ({ a: `${Math.round(i * 51.4 - 90)}deg`, d: `${15 + (i % 3) * 5}px` }));

@Component({
  selector: 'app-fav-button',
  imports: [IconDirective, FmtPipe, KeyDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <!-- 每次收藏 pop 加一：*appKey 让按钮重新创建，is-pop 动画才会重播 -->
    <button
        *appKey="pop()"
        class="fav"
        [class]="'fav--' + size()"
        [class.is-on]="on()"
        [class.is-pop]="pop() > 0"
        type="button"
        [attr.aria-pressed]="on()"
        [attr.aria-label]="(on() ? '取消收藏' : '收藏') + '，已有 ' + count() + ' 人收藏'"
        data-testid="fav-button"
        [attr.data-count]="count()"
        (click)="toggle($event)"
      >
        <span class="fav__ic"
          ><svg appIcon="heart"></svg
          >@if (burst()) {<span class="burst">@for (d of dots; track $index) {<i [style.--a]="d.a" [style.--d]="d.d"></i>}</span>}</span
        >@if (size() === 'md') {<span class="fav__t">{{ on() ? '已收藏' : '收藏' }}</span>}<span class="fav__n">{{ count() | fmt: 'num' }}</span>
      </button>
  `,
})
export class FavButtonComponent {
  readonly capsule = input.required<{ id: string; favoritedByMe: boolean; favoriteCount: number }>();
  readonly size = input<'sm' | 'md'>('sm');
  readonly changed = output<{ favorited: boolean; count: number }>();

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly plaza = inject(PlazaStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly prompt = inject(LoginPrompt);
  private readonly router = inject(Router);

  protected readonly on = linkedSignal(() => this.capsule().favoritedByMe);
  protected readonly count = linkedSignal(() => this.capsule().favoriteCount);
  protected readonly pop = signal(0);
  protected readonly burst = signal(false);
  protected readonly dots = DOTS;
  private busy = false;

  protected async toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.auth.user()) {
      await this.prompt.ask('favorite', this.router.url);
      return;
    }
    if (this.busy) return;
    this.busy = true;
    const id = this.capsule().id;
    const next = !this.on();
    const prev = { on: this.on(), count: this.count() };
    const guess = Math.max(0, prev.count + (next ? 1 : -1));
    this.on.set(next);
    this.count.set(guess);
    if (next) {
      this.pop.update((n) => n + 1);
      this.burst.set(!reducedMotion());
      setTimeout(() => this.burst.set(false), 720);
    }
    try {
      let final = guess;
      if (next) final = (await this.api.favorite(id)).favoriteCount;
      else {
        await this.api.unfavorite(id);
        this.feedback.toast('已取消收藏');
      }
      this.count.set(final);
      this.plaza.patchFavorited(id, next, final);
      this.changed.emit({ favorited: next, count: final });
    } catch {
      this.on.set(prev.on);
      this.count.set(prev.count);
      this.feedback.toast('收藏没有成功，请稍后再试', { tone: 'error' });
    } finally {
      this.busy = false;
    }
  }
}
