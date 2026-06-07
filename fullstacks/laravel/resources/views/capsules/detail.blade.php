@extends('layouts.app')
@section('title', $capsule['title'])

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-10);margin-bottom:var(--space-16)">
  <article class="cy-card" style="text-align:center">
    <div class="cy-capsule__creator" style="justify-content:center;margin-bottom:var(--space-4)">
      <img src="/static/avatars/{{ $capsule['creator']['avatarId'] }}.svg" alt="">
      <span>{{ $capsule['creator']['nickname'] }}</span>
    </div>
    <h1 style="font-family:var(--font-display);font-size:var(--font-size-4xl);margin:0 0 var(--space-3)">{{ $capsule['title'] }}</h1>
    <div class="cy-code-badge" style="margin:0 auto var(--space-4);display:inline-flex" data-code="{{ $capsule['code'] }}">
      <span>胶囊码</span><strong>{{ $capsule['code'] }}</strong>
    </div>
    <div style="display:flex;gap:var(--space-2);justify-content:center;margin-bottom:var(--space-8)">
      <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-copy-code="{{ $capsule['code'] }}">复制胶囊码</button>
      <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-share-code="{{ $capsule['code'] }}">分享</button>
    </div>

    @if($capsule['isOpened'])
      <div class="cy-alert cy-alert--success" style="justify-content:center;margin-bottom:var(--space-6)"><span>✓</span><span>已开启</span></div>
      <div class="cy-prose" style="text-align:left;white-space:pre-wrap">{{ $capsule['content'] }}</div>
    @else
      <div class="cy-alert cy-alert--info" style="justify-content:center;margin-bottom:var(--space-6)"><span>🔒</span><span>未开启</span></div>
      <div class="cy-countdown" data-open-at="{{ $capsule['openAt'] }}">
        <div><strong data-unit="days">0</strong><span>天</span></div>
        <div><strong data-unit="hours">00</strong><span>时</span></div>
        <div><strong data-unit="minutes">00</strong><span>分</span></div>
        <div><strong data-unit="seconds">00</strong><span>秒</span></div>
      </div>
      <p style="color:var(--color-text-muted);margin-top:var(--space-4)">开启时间：{{ $hello->formatDateTime($capsule['openAt']) }}</p>
    @endif
  </article>
</main>
@endsection
