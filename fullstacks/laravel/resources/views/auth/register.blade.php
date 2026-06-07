@extends('layouts.app')
@section('title', '注册')

@section('content')
@php $selected = old('avatarId', $avatars[0]['id'] ?? 'neo'); @endphp
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-6)">创建账号</h1>
  <form class="cy-form" method="post" action="/register">
    @csrf
    <div class="cy-field">
      <label for="email">邮箱</label>
      <input class="cy-input" id="email" name="email" type="email" value="{{ old('email') }}" required>
    </div>
    <div class="cy-field">
      <label for="nick">昵称</label>
      <input class="cy-input" id="nick" name="nickname" value="{{ old('nickname') }}" required>
    </div>
    <div class="cy-field">
      <label for="pwd">密码</label>
      <input class="cy-input" id="pwd" name="password" type="password" required>
    </div>
    <div class="cy-field">
      <label>选择头像</label>
      <input type="hidden" name="avatarId" id="avatarId" value="{{ $selected }}">
      <div class="cy-avatar-grid" role="radiogroup" aria-label="选择头像">
        @foreach($avatars as $avatar)
          <button type="button"
            class="cy-avatar-choice {{ $selected === $avatar['id'] ? 'is-selected' : '' }}"
            aria-label="{{ $avatar['name'] }}"
            onclick="document.getElementById('avatarId').value='{{ $avatar['id'] }}';document.querySelectorAll('.cy-avatar-choice').forEach(b=>b.classList.remove('is-selected'));this.classList.add('is-selected')">
            <img src="/static/avatars/{{ $avatar['id'] }}.svg" alt="">
          </button>
        @endforeach
      </div>
    </div>
    @if(session('error'))
      <div class="cy-alert cy-alert--danger"><span>⚠</span><span>{{ session('error') }}</span></div>
    @endif
    <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit">创建账号</button>
  </form>
</main>
@endsection
