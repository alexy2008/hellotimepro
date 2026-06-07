@extends('layouts.app')
@section('title', '关于')

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-4)">关于 HelloTime Pro</h1>
  <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">
    一款时光胶囊 Web 应用——写下一段话，设定未来某刻才能开启，内容上锁后不可修改。
    支持胶囊广场浏览、AI 辅助创作、收藏与账户管理。同时也是一个多技术栈对比学习项目，
    同一份产品需求由多套前后端框架各自实现，共享同一份 API 契约、数据库 schema 与设计 token。
  </p>

  <div class="cy-card" style="margin-bottom:var(--space-6)">
    <h2 style="font-size:var(--font-size-xl);margin:0 0 var(--space-4)">前端技术栈</h2>
    <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;margin-bottom:var(--space-4)">
      @foreach($frontendStack as $item)
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-1)">
          <img src="{{ $item['iconUrl'] }}" alt="{{ $item['name'] }}" style="width:48px;height:48px">
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:var(--font-mono)">{{ $item['name'] }} {{ $item['version'] }}</span>
        </div>
      @endforeach
    </div>
    <p style="color:var(--color-text-secondary);line-height:var(--line-height-relaxed);margin:0">{{ $frontendSummary }}</p>
  </div>

  <div class="cy-card">
    <h2 style="font-size:var(--font-size-xl);margin:0 0 var(--space-4)">后端技术栈 · {{ $health['service'] }} v{{ $health['version'] }}</h2>
    <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;margin-bottom:var(--space-4)">
      @foreach($health['stack']['items'] as $item)
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-1)">
          <img src="{{ $item['iconUrl'] }}" alt="{{ $item['name'] }}" style="width:48px;height:48px">
          <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:var(--font-mono)">{{ $item['name'] }} {{ $item['version'] }}</span>
        </div>
      @endforeach
    </div>
    <p style="color:var(--color-text-secondary);line-height:var(--line-height-relaxed);margin:0">{{ $health['stack']['summary'] }}</p>
  </div>
</main>
@endsection
