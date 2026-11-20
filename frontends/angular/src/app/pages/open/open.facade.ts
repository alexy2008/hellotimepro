// 开启页的页面逻辑：「我封存过的胶囊」——登录后取最近 3 枚；输码的状态在 CodeOpener（同样由开启页提供）
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import type { CapsuleListItem } from '@/types';

@Injectable()
export class OpenFacade {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStore);
  readonly mine = signal<CapsuleListItem[]>([]);
  readonly now = Date.now();
  private seq = 0;

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id;
      untracked(() => {
        const my = ++this.seq;
        if (!id) return this.mine.set([]);
        this.api
          .myCapsules(1, 3)
          .then((r) => my === this.seq && this.mine.set(r.items))
          .catch(() => undefined);
      });
    });
  }
}
