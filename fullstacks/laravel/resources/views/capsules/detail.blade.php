@extends('layouts.app')
@section('title', $capsule['title'])

@section('content')
@php $opened = $capsule['isOpened']; @endphp
<main class="cy-container">
  <div class="cy-capsule-detail">
    <div class="cy-capsule-detail__head">
      <span class="cy-badge {{ $opened ? 'cy-badge--opened' : 'cy-badge--sealed' }}">{{ $opened ? '已开启' : '未开启' }}</span>
      @if($capsule['inPlaza'])<span class="cy-badge cy-badge--plaza">广场公开</span>@endif
      <span class="cy-capsule__code">{{ $capsule['code'] }}</span>
      <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">
        @if($opened)· 开启于 {{ $fmt->formatDateTime($capsule['openAt']) }}@else· 创建于 {{ $fmt->formatDateTime($capsule['createdAt']) }}@endif
      </span>
    </div>

    <h1 class="cy-capsule-detail__title">{{ $capsule['title'] }}</h1>

    @if($opened)
      <div class="cy-capsule-detail__content">{{ $capsule['content'] }}</div>
    @else
      <div x-data="countdown('{{ $capsule['openAt'] }}')" class="cy-capsule-detail__sealed">
        <div style="font-size:var(--font-size-4xl);opacity:.7">🔒</div>
        <div style="color:var(--color-text-secondary);margin-top:var(--space-3);font-size:var(--font-size-sm);letter-spacing:.1em">
          这封信还在上锁，将在以下时刻开启
        </div>
        <div class="cy-cal">
          <div class="cy-cal-unit cy-cal-unit--wide">
            <div class="cy-cal-card cy-cal-card--wide"><div class="cy-cal-crease"></div><span class="cy-cal-num" x-text="days">0</span></div>
            <span class="cy-cal-label">天</span>
          </div>
          <span class="cy-cal-sep">:</span>
          <div class="cy-cal-unit">
            <div class="cy-cal-card"><div class="cy-cal-crease"></div><span class="cy-cal-num" x-text="pad(hours)">00</span></div>
            <span class="cy-cal-label">时</span>
          </div>
          <span class="cy-cal-sep">:</span>
          <div class="cy-cal-unit">
            <div class="cy-cal-card"><div class="cy-cal-crease"></div><span class="cy-cal-num" x-text="pad(minutes)">00</span></div>
            <span class="cy-cal-label">分</span>
          </div>
          <span class="cy-cal-sep">:</span>
          <div class="cy-cal-unit">
            <div class="cy-cal-card"><div class="cy-cal-crease"></div><span class="cy-cal-num" x-text="pad(seconds)">00</span></div>
            <span class="cy-cal-label">秒</span>
          </div>
        </div>
        <div style="color:var(--color-text-secondary)">
          开启于 <strong style="color:var(--color-text-primary)">{{ $fmt->formatDateTime($capsule['openAt']) }}</strong>
        </div>
      </div>
    @endif

    <div style="margin-top:var(--space-6);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-3)">
      <div style="display:flex;align-items:center;gap:var(--space-2);color:var(--color-text-secondary);font-size:var(--font-size-sm)">
        来自
        <img src="/static/avatars/{{ $capsule['creator']['avatarId'] }}.svg" alt="" style="width:32px;height:32px;border-radius:50%">
        <strong style="color:var(--color-text-primary)">{{ $capsule['creator']['nickname'] }}</strong>
      </div>
      <div x-data="shareActions('{{ $capsule['code'] }}')" style="display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap">
        <button type="button" class="cy-btn cy-btn--ghost" @click="copyCode()" x-text="copied ? '已复制' : '📎 复制 8 位码'">📎 复制 8 位码</button>
        <button type="button" class="cy-btn cy-btn--ghost" @click="shareLink()">🔗 分享链接</button>
        <div x-data="favButton('{{ $capsule['id'] }}', {{ $currentUser ? 'true' : 'false' }}, {{ $capsule['favoriteCount'] }}, {{ $capsule['favoritedByMe'] ? 'true' : 'false' }})">
          <button type="button" class="cy-capsule__fav" :class="{ 'is-active': active }"
                  @click="toggle()" aria-label="收藏">
            <span class="cy-fav-icon" x-text="active ? '♥' : '♡'">♡</span>
            <span class="cy-fav-count" x-text="count">{{ $capsule['favoriteCount'] }}</span>
          </button>
        </div>
      </div>
    </div>

    @if($opened && $capsule['inPlaza'])
      <div class="cy-alert cy-alert--success" style="margin-top:var(--space-6)">
        <span>✓</span><span>这条胶囊已在广场公开，任何人都可以通过广场或 8 位码访问。</span>
      </div>
    @else
      <div class="cy-alert cy-alert--info" style="margin-top:var(--space-6)">
        <span>ⓘ</span><span>未开启的胶囊仅显示标题与倒计时，内容将在开启后公开到广场。</span>
      </div>
    @endif
  </div>
</main>
@endsection
