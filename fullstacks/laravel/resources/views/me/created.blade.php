@extends('layouts.app')
@section('title', '我创建的胶囊')

@section('content')
<main class="cy-container">
  <div class="cy-me">
    <x-me-nav active="created" />
    <section class="cy-me__content">
      <h1>我创建的胶囊</h1>
      <div class="cy-toolbar" style="border-bottom:none;padding-top:0">
        <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">按创建时间倒序 · 共 {{ $data['pagination']['total'] }} 条</span>
        <a class="cy-btn cy-btn--primary cy-btn--sm" href="/create">新建</a>
      </div>
      <div class="cy-grid">
        @foreach($data['items'] as $capsule)
          <x-capsule-card :capsule="$capsule" :showCreator="false" :hideFavorite="true" />
        @endforeach
      </div>
      <x-pagination :pagination="$data['pagination']" base="/me/created" />
    </section>
  </div>
</main>
@endsection
