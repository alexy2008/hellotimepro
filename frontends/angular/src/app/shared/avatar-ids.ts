// 头像列表：id 以后端 /avatars 为准（测试要求从后端加载），画法用本地内联的 v2 徽记
import { DestroyRef, inject, type Signal, signal } from '@angular/core';
import { ApiService } from '@/api/api.service';
import { AVATARS } from '@/lib/avatars';

/** 在注入上下文里调用（字段初始化） */
export function injectAvatarIds(): Signal<string[]> {
  const ids = signal<string[]>([]);
  let alive = true;
  inject(DestroyRef).onDestroy(() => (alive = false));
  inject(ApiService)
    .avatars()
    .then((list) => alive && ids.set(list.map((a) => a.id)))
    .catch(() => alive && ids.set(AVATARS.map((a) => a.id)));
  return ids.asReadonly();
}
