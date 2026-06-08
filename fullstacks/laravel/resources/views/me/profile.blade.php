@extends('layouts.app')
@section('title', '账号设置')

@section('content')
<main class="cy-container">
  <div class="cy-me">
    <x-me-nav active="profile" />
    <section class="cy-me__content">
      <h1>账号设置</h1>
      <div class="cy-card cy-form" style="max-width:680px">
        <div id="profile-msg" hidden></div>
        <div class="cy-field">
          <label for="email">邮箱</label>
          <input class="cy-input" id="email" value="{{ $user['email'] }}" disabled>
        </div>
        <div class="cy-field">
          <label for="nick">昵称</label>
          <input class="cy-input" id="nick" value="{{ $user['nickname'] }}" data-initial="{{ $user['nickname'] }}" maxlength="20">
        </div>
        <div class="cy-field">
          <label>头像</label>
          <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
            @foreach($avatars as $avatar)
              <label class="cy-avatar-picker__item {{ $user['avatar_id'] === $avatar['id'] ? 'is-selected' : '' }}" title="{{ $avatar['name'] }}">
                <input type="radio" name="avatarId" value="{{ $avatar['id'] }}" data-initial="{{ $user['avatar_id'] }}"
                       {{ $user['avatar_id'] === $avatar['id'] ? 'checked' : '' }}
                       style="position:absolute;opacity:0;width:0;height:0;pointer-events:none">
                <img src="/static/avatars/{{ $avatar['id'] }}.svg" alt="{{ $avatar['name'] }}">
              </label>
            @endforeach
          </div>
        </div>
        <button type="button" id="profile-save" class="cy-btn cy-btn--primary">保存更改</button>

        <hr style="border:none;border-top:1px solid var(--color-border-subtle);margin:var(--space-8) 0;width:100%">

        <h2 style="font-size:var(--font-size-xl);margin:0">修改密码</h2>
        <div class="cy-field">
          <label for="oldPwd">当前密码</label>
          <input class="cy-input" id="oldPwd" type="password">
        </div>
        <div class="cy-field">
          <label for="newPwd">新密码</label>
          <input class="cy-input" id="newPwd" type="password">
        </div>
        <div class="cy-field">
          <label for="confirmPwd">确认新密码</label>
          <input class="cy-input" id="confirmPwd" type="password">
        </div>
        <button type="button" id="password-save" class="cy-btn cy-btn--ghost">更新密码</button>
      </div>
    </section>
  </div>
</main>
@endsection
