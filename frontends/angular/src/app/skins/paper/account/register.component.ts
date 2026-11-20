// 「时笺」注册（/register）：挑一枚邮票当头像；表单值与提交在 RegisterFacade
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RegisterFacade } from '@/pages/register/register.facade';
import { IconDirective } from '@/shared/icon.directive';
import { FieldComponent } from '@/shared/field.component';
import { NickStateComponent } from '@/shared/nick-state.component';
import { PwdRulesComponent } from '@/shared/pwd-rules.component';
import { AvatarPickerComponent } from '@/shared/avatar-picker.component';
import { TrailDirective } from '@/shared/trail.directive';
import { CONTENTS } from '@/shared/host';
import { PaperAuthArtComponent } from './auth-art.component';

@Component({
  selector: 'app-paper-register',
  imports: [RouterLink, IconDirective, FieldComponent, NickStateComponent, PwdRulesComponent, AvatarPickerComponent, TrailDirective, PaperAuthArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let e = f.errors();
    <div class="page page--auth">
      <div class="auth">
        <aside appPaperAuthArt [poem]="['纸短情长', '来日方长']" src="先留个名字，再慢慢写" seal="缄"></aside>
        <section class="auth__main">
          <div class="auth__card auth__card--wide">
            <div class="overline"><i></i>Sign up</div>
            <h1 class="h1">领一个信箱</h1>
            <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
            <form novalidate (submit)="submit($event)">
              <div class="form__row">
                <app-field
                  fieldId="email"
                  label="邮箱"
                  type="email"
                  autocomplete="email"
                  placeholder="you@example.com"
                  hint="作为登录账号，注册后不可修改。"
                  testId="register-email"
                  [autofocus]="true"
                  [error]="e['email']"
                  [(value)]="f.email"
                />
                <app-field
                  fieldId="nickname"
                  label="昵称"
                  [maxlength]="20"
                  autocomplete="nickname"
                  placeholder="2–20 个字符"
                  [hint]="f.nick().hint ?? '全站唯一，注册后可以改。'"
                  testId="register-nickname"
                  [error]="e['nickname'] ?? (f.nick().state === 'invalid' ? f.nick().hint : undefined)"
                  [(value)]="f.nickname"
                >
                  <span appNickState appTrail [state]="e['nickname'] ? 'taken' : f.nick().state"></span>
                </app-field>
              </div>
              <app-field fieldId="password" label="密码" [password]="true" autocomplete="new-password" placeholder="设置密码" testId="register-password" [error]="e['password']" [(value)]="f.password" />
              <ul appPwdRules [value]="f.password()"></ul>
              <div class="field field--plain">
                <span class="field__label">邮票头像 <small>十选一，不支持上传</small></span>
                <app-avatar-picker [ids]="f.avatarIds()" [(value)]="f.avatarId" />
              </div>
              <div class="form__err" role="alert">{{ e['form'] ?? e['avatarId'] }}</div>
              <button class="btn btn--primary btn--lg btn--block" [class.is-busy]="f.busy()" type="submit" [disabled]="f.busy()" data-testid="register-submit">
                <span>{{ f.busy() ? '正在创建…' : '创建账号，开始写信' }}</span><svg appIcon="arrow" class="ic--go"></svg>
              </button>
            </form>
            <p class="auth__alt">
              已经有账号？<a class="link" routerLink="/login" [queryParams]="f.redirect() ? { redirect: f.redirect() } : {}" data-testid="to-login">去登录</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class PaperRegisterComponent {
  protected readonly f = inject(RegisterFacade);

  protected submit(e: Event) {
    e.preventDefault();
    void this.f.submit();
  }
}
