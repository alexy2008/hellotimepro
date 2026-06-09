@extends('layouts.app')
@section('title', '注册')

@section('content')
@php $selected = old('avatarId', $avatars[0]['id'] ?? 'neo'); @endphp
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <div class="cy-card" style="max-width:560px;margin:0 auto">
    <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-2)">注册新身份</h1>
    <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">选一个赛博头像、写一封最早 60 秒后才能打开的信。</p>

    <form class="cy-form" method="post" action="/register">
      @csrf
      <div class="cy-field">
        <label for="email">邮箱</label>
        <input class="cy-input" id="email" name="email" type="email" value="{{ old('email') }}" required>
      </div>
      <div class="cy-field">
        <label for="nick">昵称</label>
        <input class="cy-input" id="nick" name="nickname" type="text" maxlength="20" value="{{ old('nickname') }}" required>
        <span class="cy-field__hint">2–20 字符，注册后可修改。</span>
      </div>
      <div class="cy-field">
        <label for="pwd">密码</label>
        <input class="cy-input" id="pwd" name="password" type="password" minlength="8" required>
        <span class="cy-field__hint">至少 8 位，需包含字母和数字。</span>
      </div>
      <div class="cy-field">
        <label>选择头像（必选）</label>
        <div x-data="avatarPicker('{{ $selected }}')">
          <input type="hidden" name="avatarId" id="avatarId" :value="selected">
          <div class="cy-avatar-picker" role="radiogroup" aria-label="选择头像">
            @foreach($avatars as $avatar)
              <button type="button" role="radio"
                class="cy-avatar-picker__item"
                :class="{ 'is-selected': selected === '{{ $avatar['id'] }}' }"
                :aria-checked="selected === '{{ $avatar['id'] }}' ? 'true' : 'false'"
                title="{{ $avatar['name'] }}" aria-label="{{ $avatar['name'] }}"
                @click="selected = '{{ $avatar['id'] }}'">
                <img src="/static/avatars/{{ $avatar['id'] }}.svg" alt="{{ $avatar['name'] }}">
              </button>
            @endforeach
          </div>
        </div>
        <span class="cy-field__hint">10 个内置头像，不支持上传自定义头像（M1 版本）。</span>
      </div>

      @if(session('error'))
        <div class="cy-alert cy-alert--danger"><span>⚠</span><span>{{ session('error') }}</span></div>
      @endif

      <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" style="width:100%">创建账号并进入创建胶囊</button>

      <div style="text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)">
        已有账号？<a href="/login" style="color:var(--color-brand-primary)">去登录</a>
      </div>
    </form>
  </div>
</main>
@endsection
