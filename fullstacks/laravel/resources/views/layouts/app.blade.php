@php
  use App\Support\UiHelper;
  $route = $routeName ?? 'plaza';
  $navKey = $navKey ?? '';
  $title = $pageTitle ?? 'HelloTime Pro · 把此刻寄给未来';
@endphp
<!doctype html>
<html lang="zh-CN" data-skin="amber" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#080b1a">
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  <title>{{ $title }}</title>
  <script>
    // 首帧之前定好皮肤与明暗，避免闪出另一套（docs/02-design.md §9.3）
    (function () {
      var root = document.documentElement;
      try {
        var skin = localStorage.getItem("hellotime.skin");
        var theme = localStorage.getItem("hellotime.theme");
        if (skin !== "paper" && skin !== "amber") skin = "amber";
        if (theme !== "dark" && theme !== "light") {
          theme = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
        }
        root.setAttribute("data-skin", skin);
        root.setAttribute("data-theme", theme);
        var colors = { paper: { light: "#F3EFE5", dark: "#131210" }, amber: { light: "#faf5ea", dark: "#080b1a" } };
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", colors[skin][theme]);
      } catch (e) {}
    })();
  </script>

  {{-- 自托管字体（时笺，@fontsource） --}}
  <link rel="stylesheet" href="/fonts/noto-serif-sc/400.css">
  <link rel="stylesheet" href="/fonts/noto-serif-sc/500.css">
  <link rel="stylesheet" href="/fonts/noto-serif-sc/700.css">
  <link rel="stylesheet" href="/fonts/noto-serif-sc/900.css">
  <link rel="stylesheet" href="/fonts/cormorant-garamond/400.css">
  <link rel="stylesheet" href="/fonts/cormorant-garamond/500.css">
  <link rel="stylesheet" href="/fonts/cormorant-garamond/600.css">
  <link rel="stylesheet" href="/fonts/cormorant-garamond/400-italic.css">
  <link rel="stylesheet" href="/fonts/cormorant-garamond/500-italic.css">
  <link rel="stylesheet" href="/fonts/ibm-plex-mono/400.css">
  <link rel="stylesheet" href="/fonts/ibm-plex-mono/500.css">

  {{-- spec/styles 2.0（严格顺序：base → 时笺三件 → 琥珀三件 → shell） --}}
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/paper/tokens.css">
  <link rel="stylesheet" href="/styles/paper/components.css">
  <link rel="stylesheet" href="/styles/paper/pages.css">
  <link rel="stylesheet" href="/styles/amber/tokens.css">
  <link rel="stylesheet" href="/styles/amber/components.css">
  <link rel="stylesheet" href="/styles/amber/pages.css">
  <link rel="stylesheet" href="/styles/shell.css">
  <link rel="stylesheet" href="/css/laravel.css">

  {{-- 服务端渲染首屏数据直出给 Alpine --}}
  <script>
    window.__HT_USER__ = @json($currentUserDto ?? null);
    window.__HT_AVATARS__ = @json($avatarCatalog->allForUi());
    window.__HT_ICONS__ = @json(UiHelper::ICONS);
    window.__HT_INIT__ = @json($initData ?? []);
  </script>
  <script defer src="/js/ht-core.js"></script>
  <script defer src="/js/ht-plaza.js"></script>
  <script defer src="/js/ht-create.js"></script>
  <script defer src="/js/ht-capsule-account.js"></script>
  <script defer src="/js/alpine.min.js"></script>
</head>
<body data-route="{{ $route }}" x-data>
  {{-- 「时笺」油墨毛边滤镜（#f-rough / #f-ink） --}}
  <svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
    <defs>
      <filter id="f-rough" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="f-ink" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="11" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.4 0 0 0 2.55" result="m"/>
        <feComposite in="d" in2="m" operator="in"/>
      </filter>
    </defs>
  </svg>

  {{-- 「琥珀」光晕 + 粒子画布 + 颗粒（时笺下由 shell.css 隐藏） --}}
  <div class="bg" aria-hidden="true" x-data="amberBackdrop()">
    <div class="bg__aurora bg__aurora--a"></div>
    <div class="bg__aurora bg__aurora--b"></div>
    <div class="bg__aurora bg__aurora--c"></div>
    <canvas class="bg__canvas" x-ref="canvas"></canvas>
    <div class="bg__grain"></div>
  </div>

  <a class="skip" href="#view">跳到正文</a>

  {{-- 页头：按当前皮肤只挂载一套 DOM --}}
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._header', ['navKey' => $navKey])
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._header', ['navKey' => $navKey])
  </template>

  <main id="view" tabindex="-1">
    @yield('content')
  </main>

  {{-- 页脚：按当前皮肤只挂载一套 DOM --}}
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._footer')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._footer')
  </template>

  {{-- 手机底栏：按当前皮肤只挂载一套 DOM --}}
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._tabbar', ['navKey' => $navKey])
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._tabbar', ['navKey' => $navKey])
  </template>

  {{-- 共用轻反馈：Toasts 与确认框 --}}
  @include('components.feedback')
</body>
</html>
