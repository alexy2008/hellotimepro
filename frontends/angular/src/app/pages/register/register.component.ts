import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@/api/api.service';
import { AuthStore } from '@/stores/auth.store';
import { ApiError, type Avatar } from '@/types';
import { AvatarPickerComponent } from '@/components/avatar-picker/avatar-picker.component';
import { AlertComponent } from '@/components/alert/alert.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarPickerComponent, AlertComponent],
  template: `
    <main class="cy-container cy-container--narrow"
      style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
      <div class="cy-card" style="max-width:560px;margin:0 auto">
        <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-2)">注册新身份</h1>
        <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">选一个赛博头像、写一封最早 60 秒后才能打开的信。</p>
        <form class="cy-form" (ngSubmit)="submit()">
          <div class="cy-field">
            <label for="email">邮箱</label>
            <input class="cy-input" id="email" type="email" required [(ngModel)]="email" name="email" />
          </div>
          <div class="cy-field">
            <label for="nick">昵称</label>
            <input class="cy-input" id="nick" type="text" maxlength="20" required [(ngModel)]="nickname" name="nickname" />
            <span class="cy-field__hint">2–20 字符，注册后可修改。</span>
          </div>
          <div class="cy-field">
            <label for="pwd">密码</label>
            <input class="cy-input" id="pwd" type="password" required minlength="8" [(ngModel)]="password" name="password" />
            <span class="cy-field__hint">至少 8 位，需包含字母和数字。</span>
          </div>
          <div class="cy-field">
            <label>选择头像（必选）</label>
            <app-avatar-picker [avatars]="avatars()" [value]="avatarId()" (onChange)="avatarId.set($event)" />
            <span class="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
          </div>
          <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" style="width:100%" [disabled]="busy()">
            {{ busy() ? '提交中…' : '创建账号并进入创建胶囊' }}
          </button>
          <div style="text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)">
            已有账号？<a routerLink="/login" style="color:var(--color-brand-primary)">去登录</a>
          </div>
        </form>
      </div>
      @if (err()) {
        <div style="max-width:560px;margin:var(--space-6) auto 0">
          <app-alert variant="danger">{{ err() }}</app-alert>
        </div>
      }
    </main>
  `,
})
export class RegisterComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthStore);
  private router = inject(Router);

  email = '';
  nickname = '';
  password = '';
  avatars = signal<Avatar[]>([]);
  avatarId = signal<string | null>(null);
  busy = signal(false);
  err = signal<string | null>(null);

  ngOnInit() {
    this.api.avatars()
      .then((list) => {
        this.avatars.set(list);
        if (list.length > 0) this.avatarId.set(list[0].id);
      })
      .catch(() => this.err.set('拉取头像列表失败，请检查后端是否已启动'));
  }

  async submit() {
    this.err.set(null);
    if (!this.avatarId()) { this.err.set('请选择一个头像'); return; }
    this.busy.set(true);
    try {
      const tokens = await this.api.register({
        email: this.email.trim(), password: this.password,
        nickname: this.nickname.trim(), avatarId: this.avatarId()!,
      });
      this.auth.setTokens(tokens);
      await this.router.navigate(['/create'], { replaceUrl: true });
    } catch (e) {
      this.err.set(e instanceof ApiError ? e.message : '注册失败');
    } finally {
      this.busy.set(false);
    }
  }
}
