import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { ApiError, type Avatar } from '@/types';
import { AvatarPickerComponent } from '@/components/avatar-picker/avatar-picker.component';
import { AlertComponent } from '@/components/alert/alert.component';

type Msg = { type: 'info' | 'success' | 'danger'; text: string };

@Component({
  selector: 'app-me-profile',
  standalone: true,
  imports: [FormsModule, AvatarPickerComponent, AlertComponent],
  template: `
    <h1>账号设置</h1>

    <!-- 基本信息 -->
    <div class="cy-card" style="margin-bottom:var(--space-6)">
      <h2 style="font-size:var(--font-size-xl);margin:0 0 var(--space-5);font-family:var(--font-display)">基本信息</h2>
      <form class="cy-form" (ngSubmit)="saveProfile()">
        <div class="cy-field">
          <label>邮箱</label>
          <input class="cy-input" [value]="auth.user()?.email ?? ''" disabled />
          <span class="cy-field__hint">邮箱作为登录账号不可修改。</span>
        </div>
        <div class="cy-field">
          <label for="nick">昵称</label>
          <input class="cy-input" id="nick" maxlength="20" [(ngModel)]="nickname" name="nickname" />
        </div>
        <div class="cy-field">
          <label>头像</label>
          <app-avatar-picker [avatars]="avatars()" [value]="avatarId()" (onChange)="avatarId.set($event)" />
        </div>
        @if (profileMsg()) {
          <app-alert [variant]="profileMsg()!.type">{{ profileMsg()!.text }}</app-alert>
        }
        <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
          <button type="button" class="cy-btn cy-btn--ghost" (click)="resetProfile()">重置</button>
          <button class="cy-btn cy-btn--primary" type="submit" [disabled]="profileBusy()">
            {{ profileBusy() ? '保存中…' : '保存更改' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 修改密码 -->
    <div class="cy-card" style="margin-bottom:var(--space-6)">
      <h2 style="font-size:var(--font-size-xl);margin:0 0 var(--space-5);font-family:var(--font-display)">修改密码</h2>
      <form class="cy-form" (ngSubmit)="changePassword()">
        <div class="cy-field">
          <label for="oldPwd">当前密码</label>
          <input class="cy-input" id="oldPwd" type="password" required [(ngModel)]="oldPwd" name="oldPwd" />
        </div>
        <div class="cy-field">
          <label for="newPwd">新密码</label>
          <input class="cy-input" id="newPwd" type="password" required minlength="8" [(ngModel)]="newPwd" name="newPwd" />
          <span class="cy-field__hint">至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。</span>
        </div>
        <div class="cy-field">
          <label for="confirmPwd">确认新密码</label>
          <input class="cy-input" id="confirmPwd" type="password" required minlength="8" [(ngModel)]="confirmPwd" name="confirmPwd" />
        </div>
        @if (pwdMsg()) {
          <app-alert [variant]="pwdMsg()!.type">{{ pwdMsg()!.text }}</app-alert>
        }
        <div style="display:flex;justify-content:flex-end">
          <button class="cy-btn cy-btn--primary" type="submit" [disabled]="pwdBusy()">
            {{ pwdBusy() ? '更新中…' : '更新密码' }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class MeProfileComponent implements OnInit {
  private api = inject(ApiService);
  auth = inject(AuthStore);
  private router = inject(Router);

  avatars = signal<Avatar[]>([]);
  avatarId = signal<string | null>(null);
  nickname = '';

  profileBusy = signal(false);
  profileMsg = signal<Msg | null>(null);

  oldPwd = '';
  newPwd = '';
  confirmPwd = '';
  pwdBusy = signal(false);
  pwdMsg = signal<Msg | null>(null);

  ngOnInit() {
    const u = this.auth.user();
    if (u) { this.nickname = u.nickname; this.avatarId.set(u.avatarId); }
    this.api.avatars().then(list => this.avatars.set(list)).catch(() => {});
  }

  resetProfile() {
    const u = this.auth.user();
    if (u) { this.nickname = u.nickname; this.avatarId.set(u.avatarId); }
  }

  async saveProfile() {
    this.profileMsg.set(null);
    this.profileBusy.set(true);
    try {
      const u = this.auth.user();
      const patch: { nickname?: string; avatarId?: string } = {};
      if (u && this.nickname !== u.nickname) patch.nickname = this.nickname.trim();
      if (u && this.avatarId() && this.avatarId() !== u.avatarId) patch.avatarId = this.avatarId()!;
      if (Object.keys(patch).length === 0) {
        this.profileMsg.set({ type: 'info', text: '没有改动' });
        return;
      }
      await this.api.updateProfile(patch);
      await this.auth.refreshMe();
      this.profileMsg.set({ type: 'success', text: '已保存' });
    } catch (e) {
      this.profileMsg.set({ type: 'danger', text: e instanceof ApiError ? e.message : '保存失败' });
    } finally {
      this.profileBusy.set(false);
    }
  }

  async changePassword() {
    this.pwdMsg.set(null);
    if (this.newPwd !== this.confirmPwd) {
      this.pwdMsg.set({ type: 'danger', text: '两次输入的新密码不一致' });
      return;
    }
    this.pwdBusy.set(true);
    try {
      await this.api.changePassword({ currentPassword: this.oldPwd, newPassword: this.newPwd });
      this.pwdMsg.set({ type: 'success', text: '密码已更新，3 秒后将自动登出。' });
      this.oldPwd = '';
      this.newPwd = '';
      this.confirmPwd = '';
      setTimeout(() => {
        void this.auth.logout(false).then(() => this.router.navigate(['/login']));
      }, 3000);
    } catch (e) {
      this.pwdMsg.set({ type: 'danger', text: e instanceof ApiError ? e.message : '修改失败' });
    } finally {
      this.pwdBusy.set(false);
    }
  }
}
