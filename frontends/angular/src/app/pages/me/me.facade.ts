// 「我的」的页面逻辑：当前页签（路由参数）与页头统计 /me/stats；列表有增删时 refresh
import { inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { FeedbackStore } from '@/stores/feedback.store';
import type { MeTab } from '@/core/guards';
import type { MyStats } from '@/types';

@Injectable()
export class MeFacade {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  private readonly feedback = inject(FeedbackStore);
  private readonly router = inject(Router);

  readonly tab = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => (p.get('tab') ?? 'created') as MeTab)), {
    initialValue: 'created' as MeTab,
  });
  readonly stats = signal<MyStats | null>(null);

  constructor() {
    this.refresh();
  }

  refresh() {
    this.api
      .myStats()
      .then((s) => this.stats.set(s))
      .catch(() => undefined);
  }

  async logout() {
    await this.auth.logout(true);
    this.feedback.toast('已登出');
    await this.router.navigateByUrl('/');
  }
}
