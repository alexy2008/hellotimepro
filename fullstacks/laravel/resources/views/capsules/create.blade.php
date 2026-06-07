@extends('layouts.app')
@section('title', '创建胶囊')

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-10);margin-bottom:var(--space-16)">
  <div style="max-width:720px;margin:0 auto">
    <h1 style="font-family:var(--font-display);font-size:var(--font-size-4xl);margin:0 0 var(--space-2)">写给未来的信</h1>
    <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">这段文字会被上锁，直到你设定的时刻才能开启。</p>
    <form method="post" action="/create" id="create-form" class="cy-form">
      @csrf
      <div class="cy-field">
        <label for="title">标题 <span style="color:var(--color-text-muted);font-weight:400">· 最多 60 字</span></label>
        <div style="display:flex;gap:var(--space-2);align-items:stretch">
          <input class="cy-input" id="title" name="title" maxlength="60" required value="{{ old('title') }}" style="flex:1">
          <button type="button" class="cy-btn cy-btn--ghost" id="ai-generate" style="white-space:nowrap">✨ AI 生成</button>
        </div>
      </div>
      <div id="reco-area"></div>
      <div class="cy-field">
        <label for="content">内容 <span style="color:var(--color-text-muted);font-weight:400">· 最多 5000 字</span></label>
        <textarea class="cy-textarea" id="content" name="content" rows="10" maxlength="5000" required>{{ old('content') }}</textarea>
      </div>
      <div class="cy-field">
        <label for="open_at">开启时间 <span style="color:var(--color-text-muted);font-weight:400">· 最早 60 秒后</span></label>
        <input class="cy-input" id="open_at" type="datetime-local" required>
        <input type="hidden" id="openAt" name="openAt" value="{{ old('openAt') }}">
        <span class="cy-field__hint">时区以你当前所在时区为准，提交时会转换为 UTC。</span>
      </div>
      <div class="cy-field">
        <label>可见性</label>
        <label class="cy-toggle">
          <input type="hidden" name="inPlaza" value="false">
          <input type="checkbox" name="inPlaza" value="true" {{ old('inPlaza', 'true') !== 'false' ? 'checked' : '' }}>
          <span class="cy-toggle__track"></span>
          <span class="cy-toggle__body">
            <span class="cy-toggle__label">发布到胶囊广场</span>
            <span class="cy-toggle__hint">开启后，胶囊标题和倒计时将对所有人可见。</span>
          </span>
        </label>
      </div>
      <div class="cy-field">
        <label>快速预设</label>
        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-preset="1m">1 分钟后（测试）</button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-preset="1h">1 小时后</button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-preset="tomorrow9">明天早上 9:00</button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-preset="1y">1 年后</button>
          <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-preset="y2030">2030.01.01</button>
        </div>
      </div>
      <div class="cy-alert cy-alert--info"><span>ⓘ</span><span>上锁后不可编辑、不可提前开启；可以在“我创建的”列表里随时撤回。</span></div>
      @if(session('error'))
        <div class="cy-alert cy-alert--danger"><span>⚠</span><span>{{ session('error') }}</span></div>
      @endif
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
        <a class="cy-btn cy-btn--ghost" href="/me/created">取消</a>
        <button class="cy-btn cy-btn--primary cy-btn--lg" type="submit">🔒 上锁封存</button>
      </div>
    </form>
  </div>
</main>
@endsection
