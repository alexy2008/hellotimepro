@extends('layouts.app')
@section('title', '登录')

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <div class="cy-card" style="max-width:440px;margin:0 auto">
    <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-2)">欢迎回来</h1>
    <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">你留给未来的信，还在等你开启。</p>

    <form class="cy-form" method="post" action="/login{{ request()->has('redirect') ? '?redirect=' . urlencode(request('redirect')) : '' }}">
      @csrf
      <div class="cy-field">
        <label for="email">邮箱</label>
        <input class="cy-input" id="email" name="email" type="email" value="{{ old('email') }}" autocomplete="email" required>
      </div>
      <div class="cy-field">
        <label for="pwd">密码</label>
        <input class="cy-input" id="pwd" name="password" type="password" autocomplete="current-password" required>
      </div>

      @if(session('error'))
        <div class="cy-alert cy-alert--danger"><span>⚠</span><span>{{ session('error') }}</span></div>
      @endif

      <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit" style="width:100%">登录</button>

      <div style="text-align:center;color:var(--color-text-muted);font-size:var(--font-size-sm)">
        还没有账号？<a href="/register" style="color:var(--color-brand-primary)">立即注册</a>
      </div>
    </form>
  </div>
</main>
@endsection
