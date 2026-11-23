@php
  use App\Support\UiHelper;
  $nk = $navKey ?? '';
@endphp
<header class="hdr" :class="$store.ui.scrolled ? 'is-scrolled' : ''">
  <div class="hdr__bar">
    <a class="brand" href="/" aria-label="HelloTime Pro 首页">
      <svg class="logo brand__logo" width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="alh-n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34267e"/><stop offset="1" stop-color="#0a0e28"/></linearGradient>
          <linearGradient id="alh-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe59a"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>
          <linearGradient id="alh-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d1ff"/></linearGradient>
          <radialGradient id="alh-w" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#alh-n)"/>
        <circle cx="32" cy="32" r="24" fill="url(#alh-w)"/>
        <g transform="rotate(45 32 32)">
          <path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 3.4"/>
          <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill="url(#alh-a)"/>
          <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill="url(#alh-g)"/>
          <rect x="26.5" y="35.5" width="11" height="10.5" rx="2" fill="#ffd98a" fill-opacity=".9"/>
          <path d="M28.8 39h6.4M28.8 42h4.6" stroke="#b06a1c" stroke-width="1.1" stroke-linecap="round"/>
          <rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550"/>
          <path d="M26.2 23a5.8 5.8 0 0 1 4.2-5.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round"/>
          <path d="M5 32A27 8 0 0 0 59 32" fill="none" stroke="#d9d3ff" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="51" cy="37.2" r="2.6" fill="#ffd27a"/>
        </g>
        <path d="M13 43q.5 3.5 4 4-3.5.5-4 4-.5-3.5-4-4 3.5-.5 4-4Z" fill="#ffe59a"/>
        <circle cx="50.5" cy="13.5" r="1.4" fill="#fff" fill-opacity=".9"/>
        <circle cx="44" cy="8.5" r=".8" fill="#fff" fill-opacity=".6"/>
      </svg>
      <span class="brand__name">HelloTime<small>PRO</small></span>
    </a>

    <nav class="nav" aria-label="主导航" x-data="amberNavInk()">
      <span class="nav__ink" aria-hidden="true"></span>
      <a href="/" data-testid="nav-plaza" class="nav__link {{ $nk === 'plaza' ? 'is-active' : '' }}" @if($nk === 'plaza') aria-current="page" @endif>胶囊广场</a>
      <a href="/create" data-testid="nav-create" class="nav__link {{ $nk === 'create' ? 'is-active' : '' }}" @if($nk === 'create') aria-current="page" @endif @click="$store.feedback.goCreate($event)">写一枚</a>
      <a href="/open" data-testid="nav-open" class="nav__link {{ $nk === 'open' ? 'is-active' : '' }}" @if($nk === 'open') aria-current="page" @endif>开启胶囊</a>
      <a href="/about" data-testid="nav-about" class="nav__link {{ $nk === 'about' ? 'is-active' : '' }}" @if($nk === 'about') aria-current="page" @endif>关于</a>
    </nav>

    <div class="hdr__tools">
      @include('components.skin-switch')
      <button
        class="theme-toggle"
        type="button"
        role="switch"
        data-testid="theme-toggle"
        :aria-checked="$store.ui.theme === 'light' ? 'true' : 'false'"
        :aria-label="$store.ui.theme === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦'"
        @click="$store.ui.toggleTheme($event)"
      >
        <span class="theme-toggle__stars"></span>
        <span class="theme-toggle__cloud"></span>
        <span class="theme-toggle__knob"></span>
      </button>

      <template x-if="$store.auth.user">
        @include('components.user-menu', ['createdIcon' => 'feather'])
      </template>
      <template x-if="!$store.auth.user">
        <div style="display:contents">
          <a class="btn btn--ghost btn--sm hdr__login" href="/login" data-testid="nav-login">登录</a>
          <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">注册</a>
        </div>
      </template>
    </div>
  </div>
</header>
