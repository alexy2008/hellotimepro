@php
  use App\Support\UiHelper;
  $stackItems = $health['stack']['items'] ?? [];
@endphp
<footer class="ftr">
  <div class="wrap ftr__in">
    <div class="ftr__brand">
      <a class="brand" href="/">
        <svg class="logo" viewBox="0 0 28 28" aria-hidden="true">
          <rect width="28" height="28" rx="6" fill="var(--color-accent)"/>
          <path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)"/>
        </svg>
        <span class="brand__name latin">HelloTime</span>
        <sup class="brand__pro mono">PRO</sup>
      </a>
      <p class="ftr__motto serif">把此刻，寄给未来。</p>
      <p class="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
    </div>
    <div class="ftr__colo">
      <div class="ftr__k">
        <span>本页由以下技术栈排印</span>
        <span class="ftr__live">
          <span class="dot dot--on"></span>
          全栈在线 · Laravel
        </span>
      </div>
      <ul class="stack" data-testid="footer-stack">
        @foreach($stackItems as $it)
          <li title="{{ UiHelper::ROLE_LABELS[$it['role']] ?? $it['role'] }}" data-testid="stack-item" data-name="{{ $it['name'] }}">
            @if(!empty($it['iconUrl']))
              <img class="tech__ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
            @else
              <span class="tech__ic tech__ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
            @endif
            <span>{{ $it['name'] }}</span>
            <small class="mono">{{ $it['version'] }}</small>
          </li>
        @endforeach
      </ul>
    </div>
  </div>
  <div class="wrap ftr__base">
    <span>© 2026 HelloTime Pro · MIT License</span>
    <nav aria-label="页脚">
      <a href="/">广场</a>
      <a href="/open">开启</a>
      <a href="/about">关于</a>
    </nav>
  </div>
</footer>
