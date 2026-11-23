@php
  use App\Support\UiHelper;
  $nk = $navKey ?? '';
@endphp
<header class="hdr" :class="$store.ui.scrolled ? 'is-scrolled' : ''">
  <div class="wrap hdr__in">
    <a class="brand" href="/" aria-label="HelloTime Pro 首页">
      <svg class="logo" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="6" fill="var(--color-accent)"/>
        <path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)"/>
      </svg>
      <span class="brand__name latin">HelloTime</span>
      <sup class="brand__pro mono">PRO</sup>
    </a>

    <nav class="nav" aria-label="主导航">
      <a href="/" data-testid="nav-plaza" class="{{ $nk === 'plaza' ? 'is-active' : '' }}" @if($nk === 'plaza') aria-current="page" @endif>广场</a>
      <a href="/open" data-testid="nav-open" class="{{ $nk === 'open' ? 'is-active' : '' }}" @if($nk === 'open') aria-current="page" @endif>开启</a>
      <a href="/about" data-testid="nav-about" class="{{ $nk === 'about' ? 'is-active' : '' }}" @if($nk === 'about') aria-current="page" @endif>关于</a>
    </nav>

    <div class="hdr__act">
      <a
        href="/create"
        data-testid="nav-create"
        class="btn btn--ghost btn--sm hdr__write {{ $nk === 'create' ? 'is-active' : '' }}"
        @if($nk === 'create') aria-current="page" @endif
        @click="$store.feedback.goCreate($event)"
      >
        {!! UiHelper::icon('pen') !!}
        写一枚
      </a>
      @include('components.skin-switch')
      <button
        class="iconbtn theme"
        type="button"
        data-testid="theme-toggle"
        :aria-label="$store.ui.theme === 'dark' ? '切换到日间主题' : '切换到夜间主题'"
        @click="$store.ui.toggleTheme($event)"
      >
        {!! UiHelper::icon('sun', 'theme__sun') !!}
        {!! UiHelper::icon('moon', 'theme__moon') !!}
      </button>

      <template x-if="$store.auth.user">
        @include('components.user-menu', ['createdIcon' => 'mail'])
      </template>
      <template x-if="!$store.auth.user">
        <div style="display:contents">
          <a class="btn btn--text hdr__login" href="/login" data-testid="nav-login">登录</a>
          <a class="btn btn--primary btn--sm" href="/register" data-testid="nav-register">注册</a>
        </div>
      </template>
    </div>
  </div>
</header>
