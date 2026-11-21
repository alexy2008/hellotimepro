// 「琥珀」注册（/register）：挑一颗星球当头像；表单值与提交在 RegisterFacade
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
import { AmberAuthArtComponent } from './auth-art.component';

@Component({
  selector: 'app-amber-register',
  imports: [RouterLink, IconDirective, FieldComponent, NickStateComponent, PwdRulesComponent, AvatarPickerComponent, TrailDirective, AmberAuthArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let e = f.errors();
    <div class="page page--auth">
      <div class="container auth">
        <div class="auth__card auth__card--wide card">
          <div appAmberAuthArt state="opened"></div>
          <div class="eyebrow eyebrow--center">Create account</div>
          <h1 class="page-title">领一个身份</h1>
          <p class="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>
          <form novalidate (submit)="$event.preventDefault(); f.submit()">
            <div class="form__row">
              <app-field
                fieldId="email"
                label="邮箱"
                type="email"
                lead="mail"
                [req]="true"
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
                lead="user"
                [req]="true"
                autocomplete="nickname"
                placeholder="2–20 个字符"
                [hint]="f.nick().hint ?? '全站唯一，注册后可以改。'"
                testId="register-nickname"
                [error]="e['nickname'] ?? (f.nick().state === 'invalid' ? f.nick().hint : undefined)"
                [value]="f.nickname()" (valueChange)="f.setNickname($event)"
              >
                <span appNickState appTrail [state]="f.nick().state"></span>
              </app-field>
            </div>
            <app-field fieldId="password" label="密码" lead="lock" [req]="true" [password]="true" autocomplete="new-password" placeholder="设置密码" testId="register-password" [error]="e['password']" [(value)]="f.password" />
            <ul appPwdRules [value]="f.password()"></ul>
            <div class="field field--plain">
              <div class="field__head"><span class="field__label">头像 <em>*</em></span><span class="field__count">十选一，不支持上传</span></div>
              <app-avatar-picker [ids]="f.avatarIds()" [(value)]="f.avatarId" />
            </div>
            <div class="form__err" role="alert">{{ e['form'] ?? e['avatarId'] }}</div>
            <button class="btn btn--primary btn--lg btn--block" [class.is-busy]="f.busy()" type="submit" [disabled]="f.busy()" data-testid="register-submit">
              <span>{{ f.busy() ? '正在创建…' : '创建账号，开始写胶囊' }}</span><svg appIcon="arrow"></svg>
            </button>
          </form>
          <p class="auth__alt">已经有账号？<a routerLink="/login" [queryParams]="f.redirect() ? { redirect: f.redirect() } : {}" data-testid="to-login">去登录</a></p>
        </div>
      </div>
    </div>
  `,
})
export class AmberRegisterComponent {
  protected readonly f = inject(RegisterFacade);
}
