// ============================================================
// 指向 /create 的链接：<a appCreateLink class="btn btn--primary">…</a>
// 已登录直接去；匿名时先确认，再去 /login?redirect=/create（X7）。
// 不用 routerLink：它的点击处理与本指令的先后顺序不可控，来不及拦下匿名点击。
// ============================================================

import { Directive, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@/stores/auth.store';
import { LoginPrompt } from '@/core/login-prompt.service';

@Directive({
  selector: 'a[appCreateLink]',
  host: { href: '/create', '(click)': 'onClick($event)' },
})
export class CreateLinkDirective {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly prompt = inject(LoginPrompt);

  protected onClick(e: MouseEvent) {
    // 新标签页打开之类：交给浏览器
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (this.auth.user()) void this.router.navigateByUrl('/create');
    else void this.prompt.ask('create', '/create');
  }
}
