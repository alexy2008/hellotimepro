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
    <h1>封存此刻 开启未来</h1>
    <p>写下此刻最真实的想法，设定一个解封时刻。时间到了，它才会被打开。</p>
    <div class="cy-hero-actions">
      <a class="cy-btn cy-btn--primary cy-btn--lg" href="{{ $currentUser ? '/create' : '/login?redirect=/create' }}">创建我的胶囊</a>
      <a class="cy-btn cy-btn--ghost cy-btn--lg" href="/open">用胶囊码开启</a>
    </div>
  </div>
</section>

<main class="cy-container" style="margin-bottom:var(--space-16)">
  <div class="cy-toolbar">
    <div class="cy-segment">
      <a class="{{ $sort === 'new' ? 'is-active' : '' }}" href="/?{{ http_build_query(array_merge($query, ['sort' => 'new', 'page' => 1])) }}">最新</a>
      <a class="{{ $sort === 'hot' ? 'is-active' : '' }}" href="/?{{ http_build_query(array_merge($query, ['sort' => 'hot', 'page' => 1])) }}">最热</a>
    </div>
    <div class="cy-segment">
      <a class="{{ $filter === 'all' ? 'is-active' : '' }}" href="/?{{ http_build_query(array_merge($query, ['filter' => 'all', 'page' => 1])) }}">全部</a>
      <a class="{{ $filter === 'unopened' ? 'is-active' : '' }}" href="/?{{ http_build_query(array_merge($query, ['filter' => 'unopened', 'page' => 1])) }}">未开启</a>
      <a class="{{ $filter === 'opened' ? 'is-active' : '' }}" href="/?{{ http_build_query(array_merge($query, ['filter' => 'opened', 'page' => 1])) }}">已开启</a>
    </div>
    <div class="cy-search">
      <input class="cy-search__input" placeholder="搜索标题或昵称" value="{{ $q }}">
      <input type="hidden" name="sort" value="{{ $sort }}">
      <input type="hidden" name="filter" value="{{ $filter }}">
    </div>
  </div>

  @if(empty($data['items']))
    <div class="cy-empty">还没有匹配的胶囊。</div>
  @else
    <div class="cy-grid">
      @foreach($data['items'] as $capsule)
        <x-capsule-card :capsule="$capsule" />
      @endforeach
    </div>
    <x-pagination :pagination="$data['pagination']" base="/" :query="$query" />
  @endif
</main>
@endsection
