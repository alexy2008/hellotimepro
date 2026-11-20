// 「时笺」登录（/login）：结构与类名照 2.0 原型 paper/view-account.js；表单值与提交在 LoginFacade
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginFacade } from '@/pages/login/login.facade';
import { IconDirective } from '@/shared/icon.directive';
import { FieldComponent } from '@/shared/field.component';
import { CONTENTS } from '@/shared/host';
import { PaperAuthArtComponent } from './auth-art.component';

@Component({
  selector: 'app-paper-login',
  imports: [RouterLink, IconDirective, FieldComponent, PaperAuthArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--auth">
      <div class="auth">
        <aside appPaperAuthArt [poem]="['见字如面', '展信安好']" src="写信的人，在等回信的你" seal="信"></aside>
        <section class="auth__main">
          <div class="auth__card">
            <div class="overline"><i></i>Sign in</div>
            <h1 class="h1">欢迎回来</h1>
            <p class="lede">你留给未来的信，还在等你开启。</p>
            @if (f.redirect()) {
              <p class="note note--inline"><svg appIcon="info"></svg><span>登录后会带你回到刚才的页面。</span></p>
            }
            <form novalidate (submit)="submit($event)" (input)="f.onInput()">
              <app-field fieldId="email" label="邮箱" type="email" autocomplete="email" placeholder="you@example.com" testId="login-email" [autofocus]="true" [error]="f.errors()['email']" [(value)]="f.email" />
              <app-field
                fieldId="password"
                label="密码"
                [password]="true"
                autocomplete="current-password"
                placeholder="输入密码"
                hint="忘记密码？当前版本暂不支持找回。"
                testId="login-password"
                [error]="f.errors()['password']"
                [(value)]="f.password"
              />
              <div class="form__err" role="alert" [attr.data-testid]="f.errors()['form'] ? 'login-error' : null">{{ f.errors()['form'] }}</div>
              <button class="btn btn--primary btn--lg btn--block" [class.is-busy]="f.busy()" type="submit" [disabled]="f.busy()" data-testid="login-submit">
                <span>{{ f.busy() ? '登录中…' : '登录' }}</span><svg appIcon="arrow" class="ic--go"></svg>
              </button>
            </form>
            <p class="auth__alt">
              还没有账号？<a class="link" routerLink="/register" [queryParams]="f.redirect() ? { redirect: f.redirect() } : {}" data-testid="to-register">注册一个</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class PaperLoginComponent {
  protected readonly f = inject(LoginFacade);

  protected submit(e: Event) {
    e.preventDefault();
    void this.f.submit();
  }
}
