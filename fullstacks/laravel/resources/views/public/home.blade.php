@extends('layouts.app')
@section('title', '广场')

@section('content')
@php
  $query = $query ?? [];
  $sort = $query['sort'] ?? 'new';
  $filter = $query['filter'] ?? 'all';
  $q = $query['q'] ?? '';
@endphp

<section class="cy-hero-block">
  <div class="cy-container">
    <h1 class="cy-hero-title">封存此刻 <span class="cy-hero-title__highlight">开启未来</span></h1>
    <p class="cy-hero-subtitle">
      写下此刻最真实的想法，设定一个解封时刻——可以是明年生日、十年后的某个清晨，或任何你觉得值得等待的瞬间。时间到了，它才会被打开。
    </p>
    <div class="cy-hero-cta">
      <a class="cy-btn cy-btn--primary cy-btn--hero" href="{{ $currentUser ? '/create' : '/register' }}">创建我的胶囊</a>
      <a class="cy-btn cy-btn--success cy-btn--hero" href="/open">用胶囊码开启</a>
    </div>
  </div>
</section>

<main class="cy-container">
  <div class="cy-toolbar">
    <div class="cy-toolbar__group">
      <form class="cy-seg" method="get" action="/">
        <input type="hidden" name="filter" value="{{ $filter }}">
        @if($q !== '')<input type="hidden" name="q" value="{{ $q }}">@endif
        <button type="submit" name="sort" value="hot" class="{{ $sort === 'hot' ? 'cy-seg__active' : '' }}">🔥 热门</button>
        <button type="submit" name="sort" value="new" class="{{ $sort === 'new' ? 'cy-seg__active' : '' }}">✨ 最新</button>
      </form>
      <form class="cy-seg" method="get" action="/">
        <input type="hidden" name="sort" value="{{ $sort }}">
        @if($q !== '')<input type="hidden" name="q" value="{{ $q }}">@endif
        <button type="submit" name="filter" value="all" class="{{ $filter === 'all' ? 'cy-seg__active' : '' }}">全部</button>
        <button type="submit" name="filter" value="opened" class="{{ $filter === 'opened' ? 'cy-seg__active' : '' }}">已开启</button>
        <button type="submit" name="filter" value="unopened" class="{{ $filter === 'unopened' ? 'cy-seg__active' : '' }}">未开启</button>
      </form>
    </div>
    <form class="cy-search" role="search" method="get" action="/">
      <input type="hidden" name="sort" value="{{ $sort }}">
      <input type="hidden" name="filter" value="{{ $filter }}">
      <span class="cy-search__icon" aria-hidden="true">🔍</span>
      {{-- 仅当搜索框仍持有焦点时才提交：停止输入即实时过滤；若中途点了卡片/收藏等
           （焦点已离开），则不触发这次迟到的整页跳转，避免与后续导航相撞致 ERR_ABORTED。 --}}
      <input type="search" class="cy-search__input" name="q" placeholder="搜索标题或昵称…" maxlength="50" value="{{ $q }}"
             @input.debounce.300ms="document.activeElement === $el && $el.form.submit()">
    </form>
  </div>

  @if(empty($data['items']))
    <div class="cy-empty">
      <div class="cy-empty__emoji">🌌</div>
      <p>广场暂无胶囊 —— 来当第一个写信给未来的人？</p>
    </div>
  @else
    <div class="cy-grid">
      @foreach($data['items'] as $capsule)
        <x-capsule-card :capsule="$capsule" :show-creator="true" :hide-favorite="false" />
      @endforeach
    </div>
    <x-pagination :pagination="$data['pagination']" base="/" :query="$query" />
  @endif
</main>
@endsection
