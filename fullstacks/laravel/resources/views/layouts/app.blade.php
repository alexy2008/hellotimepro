<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@yield('title', 'HelloTime Pro') · HelloTime Pro</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg">
  @php
    // 资源带 mtime 版本号，避免浏览器缓存旧的 CSS/JS（改动后能即时生效）。
    $cssV = @filemtime(public_path('css/app.css')) ?: time();
    $dtpCssV = @filemtime(public_path('css/dtp.css')) ?: time();
    $jsV = @filemtime(public_path('js/app.js')) ?: time();
  @endphp
  <link rel="stylesheet" href="/css/app.css?v={{ $cssV }}">
  <link rel="stylesheet" href="/css/dtp.css?v={{ $dtpCssV }}">
  <style>[x-cloak]{display:none!important}</style>
  {{-- app.js 注册 Alpine.data/store，必须在 Alpine 核心之前执行（两者皆 defer，按文档顺序运行），
       否则 Alpine 启动并派发 alpine:init 时组件尚未登记。 --}}
  <script src="/js/app.js?v={{ $jsV }}" defer></script>
  <script src="/js/alpine.min.js" defer></script>
</head>
{{-- 空 x-data 提供页面级 Alpine 根作用域，使 header 主题切换、广场搜索等
     不在独立组件内的 @click/@input 指令与 $store 生效。 --}}
<body x-data>
  <header class="cy-header">
    <div class="cy-container cy-header__inner">
      <a href="/" class="cy-brand">
        <img class="cy-brand__mark" src="/logo.svg" width="38" height="38" alt="">
        HelloTime<span class="cy-brand__pro">PRO</span>
      </a>
      <nav class="cy-nav">
        <a href="/">广场</a>
        <a href="/open">开启</a>
        <a href="/about">关于</a>
      </nav>
      <div class="cy-header__actions">
        <button type="button" class="cy-theme-toggle" aria-label="切换主题" @click="$store.theme.toggle()"><span>☾</span></button>
        @if($currentUser)
          <div x-data="{ open: false }" class="cy-user-menu">
            <button type="button" class="cy-user-chip cy-user-chip--button" @click="open = !open" :aria-expanded="String(open)" title="{{ $currentUser['nickname'] }}" aria-label="{{ $currentUser['nickname'] }} 的菜单">
              <span>{{ $fmt->shortName($currentUser['nickname']) }}</span>
              <img src="/static/avatars/{{ $currentUser['avatar_id'] }}.svg" alt="">
              <span class="cy-user-chip__chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="cy-user-dropdown" role="menu" x-show="open" x-cloak @click.outside="open = false" x-transition.opacity.duration.100ms>
              <a href="/me/created" role="menuitem" class="cy-user-dropdown__item"><span>📝</span><span>我创建的</span></a>
              <a href="/me/favorites" role="menuitem" class="cy-user-dropdown__item"><span>♥</span><span>我收藏的</span></a>
              <a href="/me/profile" role="menuitem" class="cy-user-dropdown__item"><span>⚙</span><span>账号设置</span></a>
              <span class="cy-user-dropdown__divider"></span>
              <form method="post" action="/logout" style="margin:0">
                @csrf
                <button type="submit" role="menuitem" class="cy-user-dropdown__item cy-user-dropdown__item--danger"><span>↩</span><span>登出</span></button>
              </form>
            </div>
          </div>
        @else
          <a class="cy-btn cy-btn--ghost" href="/login">登录</a>
          <a class="cy-btn cy-btn--primary" href="/register">注册</a>
        @endif
      </div>
    </div>
  </header>

  @yield('content')

  <footer class="cy-footer">
    <div class="cy-container cy-footer__inner">
      <div>© 2026 HelloTime Pro <span class="cy-backend-dot cy-backend-dot--online"></span></div>
      <div class="cy-stack">
        @foreach(($health['stack']['items'] ?? []) as $item)
          <span class="cy-stack__item" title="{{ $item['role'] ?? '' }}">
            @if(!empty($item['iconUrl']))<img src="{{ $item['iconUrl'] }}" alt="">@endif
            {{ $item['name'] }}
          </span>
        @endforeach
      </div>
    </div>
  </footer>
</body>
</html>
