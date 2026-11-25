@php
  use App\Support\UiHelper;
  $stackItems = $health['stack']['items'] ?? [];
@endphp
<footer class="ftr">
  <div class="ftr__in">
    <a class="ftr__brand" href="/">
      <svg class="logo" width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="alf-n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34267e"/><stop offset="1" stop-color="#0a0e28"/></linearGradient>
          <linearGradient id="alf-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe59a"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>
          <linearGradient id="alf-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d1ff"/></linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#alf-n)"/>
        <g transform="rotate(45 32 32)">
          <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill="url(#alf-a)"/>
          <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill="url(#alf-g)"/>
          <rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550"/>
        </g>
      </svg>
      HelloTime Pro · 时间胶囊
    </a>
    <div class="ftr__stack" data-testid="footer-stack">
      <span class="ftr__dot" title="服务在线" data-online="true"></span>
      @foreach($stackItems as $it)
        <span
          class="ftr__tech"
          title="{{ (UiHelper::ROLE_LABELS[$it['role']] ?? $it['role']) . ' · ' . $it['name'] . ' ' . ($it['version'] ?? '') }}"
          data-testid="stack-item"
          data-name="{{ $it['name'] }}"
        >
          @if(!empty($it['iconUrl']))
            <img class="tech-ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
          @else
            <span class="tech-ic tech-ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
          @endif
          {{ $it['name'] }}
        </span>
      @endforeach
    </div>
    <div class="ftr__meta">
      <span>把此刻，寄给未来</span>
      <span class="mono">v2.0</span>
    </div>
  </div>
</footer>
