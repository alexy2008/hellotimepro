@extends('layouts.app')
@section('title', '我收藏的胶囊')

@section('content')
<main class="cy-container">
  <div class="cy-me">
    <x-me-nav active="favorites" />
    <section class="cy-me__content">
      <h1>我收藏的胶囊</h1>
      <div class="cy-toolbar" style="border-bottom:none;padding-top:0">
        <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">按收藏时间倒序 · 共 {{ $data['pagination']['total'] }} 条</span>
      </div>
      <div class="cy-grid">
        @foreach($data['items'] as $capsule)
          <x-capsule-card :capsule="$capsule" />
        @endforeach
      </div>
      <x-pagination :pagination="$data['pagination']" base="/me/favorites" />
    </section>
  </div>
</main>
@endsection
