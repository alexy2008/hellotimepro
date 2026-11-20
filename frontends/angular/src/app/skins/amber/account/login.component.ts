// 「琥珀」登录（/login）：结构与类名照 2.0 原型 amber/view-account.js；表单值与提交在 LoginFacade
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginFacade } from '@/pages/login/login.facade';
import { IconDirective } from '@/shared/icon.directive';
import { FieldComponent } from '@/shared/field.component';
import { CONTENTS } from '@/shared/host';
import { AmberAuthArtComponent } from './auth-art.component';

@Component({
  selector: 'app-amber-login',
  imports: [RouterLink, IconDirective, FieldComponent, AmberAuthArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    <div class="page page--auth">
      <div class="container auth">
        <div class="auth__card card">
          <div appAmberAuthArt state="locked"></div>
          <div class="eyebrow eyebrow--center">Welcome back</div>
          <h1 class="page-title">欢迎回来</h1>
          <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
          @if (f.redirect()) {
            <p class="tip"><svg appIcon="info"></svg><span>登录后会带你回到刚才的页面。</span></p>
          }
          <form novalidate (submit)="$event.preventDefault(); f.submit()" (input)="f.onInput()">
            <app-field fieldId="email" label="邮箱" type="email" lead="mail" autocomplete="email" placeholder="you@example.com" testId="login-email" [autofocus]="true" [error]="f.errors()['email']" [(value)]="f.email" />
            <app-field
              fieldId="password"
              label="密码"
              lead="lock"
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
              <span>{{ f.busy() ? '登录中…' : '登录' }}</span><svg appIcon="arrow"></svg>
            </button>
          </form>
          <p class="auth__alt">还没有账号？<a routerLink="/register" [queryParams]="f.redirect() ? { redirect: f.redirect() } : {}" data-testid="to-register">注册一个</a></p>
        </div>
      </div>
    </div>
  `,
})
export class AmberLoginComponent {
  protected readonly f = inject(LoginFacade);
}
