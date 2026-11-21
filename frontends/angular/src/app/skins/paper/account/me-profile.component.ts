// 「账号设置」：基本信息（昵称、邮票头像）+ 修改密码；值与提交在 ProfileFacade
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileFacade } from '@/pages/me/profile.facade';
import { IconDirective } from '@/shared/icon.directive';
import { FieldComponent } from '@/shared/field.component';
import { NickStateComponent } from '@/shared/nick-state.component';
import { PwdRulesComponent } from '@/shared/pwd-rules.component';
import { AvatarPickerComponent } from '@/shared/avatar-picker.component';
import { FormMsgComponent } from '@/shared/form-msg.component';
import { TrailDirective } from '@/shared/trail.directive';
import { CONTENTS } from '@/shared/host';

@Component({
  selector: 'app-paper-me-profile',
  imports: [IconDirective, FieldComponent, NickStateComponent, PwdRulesComponent, AvatarPickerComponent, FormMsgComponent, TrailDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: CONTENTS,
  template: `
    @let e = p.errors();
    <div class="profile">
      <section class="pane">
        <h2 class="pane__h">基本信息</h2>
        <form novalidate (submit)="$event.preventDefault(); p.saveProfile()">
          <app-field fieldId="p-email" label="邮箱" type="email" [disabled]="true" hint="邮箱是登录账号，不可修改。" [value]="p.user().email">
            <span appTrail class="field__state is-lock" aria-hidden="true"><svg appIcon="lock"></svg></span>
          </app-field>
          <app-field
            fieldId="p-nick"
            label="昵称"
            autocomplete="nickname"
            [hint]="p.nickHint() ?? '2–20 个字符，全站唯一。'"
            testId="profile-nickname"
            [error]="e['nickname']"
            [value]="p.nickname()"
            (valueChange)="p.set('nickname', $event)"
          >
            <span appNickState appTrail [state]="p.nick()"></span>
          </app-field>
          <div class="field field--plain">
            <span class="field__label">邮票头像</span>
            <app-avatar-picker [ids]="p.avatarIds()" [(value)]="p.avatarId" />
          </div>
          <div appFormMsg [m]="p.msg()"></div>
          <div class="pane__act">
            <button class="btn btn--ghost" type="button" (click)="p.resetProfile()">重置</button>
            <button class="btn btn--primary" [class.is-busy]="p.busy()" type="submit" [disabled]="p.busy()" data-testid="profile-save">
              <span>{{ p.busy() ? '保存中…' : '保存更改' }}</span>
            </button>
          </div>
        </form>
      </section>

      <section class="pane">
        <h2 class="pane__h">修改密码</h2>
        <form novalidate (submit)="$event.preventDefault(); p.changePassword()">
          <app-field fieldId="pw-cur" label="当前密码" [password]="true" autocomplete="current-password" testId="pwd-current" errorKey="current" [error]="e['current']" [value]="p.pwdCurrent()" (valueChange)="p.set('current', $event)" />
          <app-field fieldId="pw-new" label="新密码" [password]="true" autocomplete="new-password" testId="pwd-new" errorKey="new" [error]="e['next']" [value]="p.pwdNext()" (valueChange)="p.set('next', $event)" />
          <ul appPwdRules [value]="p.pwdNext()"></ul>
          <app-field fieldId="pw-again" label="再输一次新密码" [password]="true" autocomplete="new-password" testId="pwd-confirm" errorKey="confirm" [error]="e['confirm']" [value]="p.pwdConfirm()" (valueChange)="p.set('confirm', $event)" />
          <div appFormMsg [m]="p.pwdMsg()"></div>
          <p class="pane__fine"><svg appIcon="info"></svg>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</p>
          <div class="pane__act">
            <button class="btn btn--primary" [class.is-busy]="p.pwdBusy()" type="submit" [disabled]="p.pwdBusy()" data-testid="pwd-submit">
              <span>{{ p.pwdBusy() ? '更新中…' : '更新密码' }}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class PaperMeProfileComponent {
  protected readonly p = inject(ProfileFacade);
}
