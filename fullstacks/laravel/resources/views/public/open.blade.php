@extends('layouts.app')
@section('title', '开启胶囊')

@section('content')
<main class="cy-container cy-container--narrow" style="margin-top:var(--space-12);margin-bottom:var(--space-16)">
  <h1 style="font-family:var(--font-display);font-size:var(--font-size-3xl);margin:0 0 var(--space-2)">输入 8 位胶囊码开启</h1>
  <p style="color:var(--color-text-secondary);margin:0 0 var(--space-8)">输入 8 位胶囊码，查看它是否已经到达开启时刻。</p>
  <div class="cy-card">
    <div class="cy-code-input">
      @for($i = 1; $i <= 8; $i++)
        <input maxlength="1" inputmode="text" aria-label="第 {{ $i }} 位">
      @endfor
    </div>
  </div>
</main>
@endsection
