@extends('layouts.app')
@section('title', '登录')

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-6)">登录</h1>
  <form class="cy-form" method="post" action="/login{{ request()->has('redirect') ? '?redirect=' . urlencode(request('redirect')) : '' }}">
    @csrf
    <div class="cy-field">
      <label for="email">邮箱</label>
      <input class="cy-input" id="email" name="email" type="email" value="{{ old('email') }}" required>
    </div>
    <div class="cy-field">
      <label for="pwd">密码</label>
      <input class="cy-input" id="pwd" name="password" type="password" required>
    </div>
    @if(session('error'))
      <div class="cy-alert cy-alert--danger"><span>⚠</span><span>{{ session('error') }}</span></div>
    @endif
    <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit">登录</button>
    <p style="color:var(--color-text-muted)">还没有账号？<a href="/register">创建账号</a></p>
  </form>
</main>
@endsection
