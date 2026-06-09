@extends('layouts.app')
@section('title', '账号设置')

@section('content')
<main class="cy-container">
  <div class="cy-me">
    <x-me-nav active="profile" />
    <section class="cy-me__content" x-data="profileEditor('{{ $user['nickname'] }}', '{{ $user['avatar_id'] }}')">
      <h1>账号设置</h1>
      <div class="cy-card cy-form" style="max-width:680px">
        <div x-show="msg" :class="msgType" x-text="msg" x-cloak></div>
        <div class="cy-field">
          <label for="email">邮箱</label>
          <input class="cy-input" id="email" value="{{ $user['email'] }}" disabled>
        </div>
        <div class="cy-field">
          <label for="nick">昵称</label>
          <input x-model="nickname" class="cy-input" id="nick" maxlength="20">
        </div>
        <div class="cy-field">
          <label>头像</label>
          <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
            @foreach($avatars as $avatar)
              <label class="cy-avatar-picker__item" :class="{ 'is-selected': selectedAvatar === '{{ $avatar['id'] }}' }"
                     :aria-checked="selectedAvatar === '{{ $avatar['id'] }}' ? 'true' : 'false'" title="{{ $avatar['name'] }}">
                <input type="radio" name="avatarId" value="{{ $avatar['id'] }}" x-model="selectedAvatar"
                       style="position:absolute;opacity:0;width:0;height:0;pointer-events:none">
                <img src="/static/avatars/{{ $avatar['id'] }}.svg" alt="{{ $avatar['name'] }}">
              </label>
            @endforeach
          </div>
        </div>
        <button type="button" @click="saveProfile()" :disabled="saving" class="cy-btn cy-btn--primary">保存更改</button>

        <hr style="border:none;border-top:1px solid var(--color-border-subtle);margin:var(--space-8) 0;width:100%">

        <h2 style="font-size:var(--font-size-xl);margin:0">修改密码</h2>
        <div x-show="pwdMsg" :class="pwdMsgType" x-text="pwdMsg" x-cloak></div>
        <div class="cy-field">
          <label for="oldPwd">当前密码</label>
          <input x-model="oldPwd" class="cy-input" id="oldPwd" type="password">
        </div>
        <div class="cy-field">
          <label for="newPwd">新密码</label>
          <input x-model="newPwd" class="cy-input" id="newPwd" type="password">
        </div>
        <div class="cy-field">
          <label for="confirmPwd">确认新密码</label>
          <input x-model="confirmPwd" class="cy-input" id="confirmPwd" type="password">
        </div>
        <button type="button" @click="savePassword()" :disabled="pwdSaving" class="cy-btn cy-btn--ghost">更新密码</button>
      </div>
    </section>
  </div>
</main>
@endsection
