@extends('layouts.app')
@section('title', '开启胶囊')

@section('content')
<main class="cy-container">
  <div class="cy-open-center">
    <h1>用 8 位密钥开启胶囊</h1>
    <p>输入朋友分享给你的 8 位大写字母和数字，凑齐后会自动跳转到胶囊。</p>

    <div x-data="codeInput()" class="cy-code-input" style="margin-bottom:var(--space-8)">
      @for($i = 0; $i < 8; $i++)
        <input x-ref="d{{ $i }}" x-model="d[{{ $i }}]" @input="onInput({{ $i }})" @paste="onPaste($event)"
               maxlength="1" inputmode="text" aria-label="第 {{ $i + 1 }} 位">
      @endfor
    </div>

    <div style="margin-top:var(--space-10);color:var(--color-text-muted);font-size:var(--font-size-sm)">
      <div style="display:flex;gap:var(--space-4);justify-content:center;flex-wrap:wrap">
        <span>💡 可用 <code style="background:var(--color-surface-2);padding:2px 6px;border-radius:var(--radius-sm)">/c/8F2K9R4M</code> 直链访问</span>
        <span>🔒 未到开启时间的胶囊也会显示倒计时</span>
      </div>
    </div>
  </div>
</main>
@endsection
