{{-- 首次响应即可阅读。Alpine 挂载当前皮肤后移除此区域。 --}}
<section class="ssr-content" data-server-rendered>
  @switch($route)
    @case('plaza')
      <h1>把此刻，寄给未来</h1>
      <h2>胶囊广场</h2>
      <p>
        广场共 {{ $initData['overview']['counts']['all'] }} 枚，
        {{ $initData['overview']['counts']['unopened'] }} 枚封存中，
        {{ $initData['overview']['counts']['opened'] }} 枚已开启。
      </p>
      <form class="ssr-links" method="get" action="/" role="search">
        <label>关键词 <input type="search" name="q" value="{{ $initData['query']['q'] }}"></label>
        <label>筛选
          <select name="filter">
            @foreach (['all' => '全部', 'opened' => '已开启', 'unopened' => '封存中'] as $value => $label)
              <option value="{{ $value }}" @selected($initData['query']['filter'] === $value)>{{ $label }}</option>
            @endforeach
          </select>
        </label>
        <label>排序
          <select name="sort">
            <option value="new" @selected($initData['query']['sort'] === 'new')>最新封存</option>
            <option value="hot" @selected($initData['query']['sort'] === 'hot')>最多收藏</option>
          </select>
        </label>
        <button type="submit">搜索</button>
      </form>
      @include('components.server-capsule-list', ['capsules' => $initData['items']])
      @php($pageInfo = $initData['pagination'])
      <nav class="ssr-links" aria-label="广场分页">
        @if ($pageInfo['page'] > 1)
          <a href="{{ '/?' . http_build_query(array_replace($initData['query'], ['page' => $pageInfo['page'] - 1])) }}">上一页</a>
        @endif
        <span>共 {{ $pageInfo['total'] }} 枚</span>
        @if ($pageInfo['page'] < $pageInfo['totalPages'])
          <a href="{{ '/?' . http_build_query(array_replace($initData['query'], ['page' => $pageInfo['page'] + 1])) }}">下一页</a>
        @endif
      </nav>
      @break
    @case('capsule')
      <a href="{{ $plazaReturnUrl }}">返回广场</a>
      @php($capsule = $initData['capsule'])
      @if ($capsule)
        <article>
          <h1>{{ $capsule['title'] }}</h1>
          <p>{{ $capsule['creator']['nickname'] }} · {{ $capsule['code'] }}</p>
          @if ($capsule['isOpened'])
            <div class="ssr-letter">{{ $capsule['content'] }}</div>
          @else
            <p>尚未开启。开启时间 <time datetime="{{ $capsule['openAt'] }}">{{ $fmt->formatDateTime($capsule['openAt']) }}</time></p>
          @endif
        </article>
      @elseif ($initData['status'] === 'missing')
        <h1>查无此信</h1>
        <p>没有找到胶囊码为 {{ $initData['code'] }} 的胶囊。</p>
      @else
        <h1>暂时无法加载胶囊</h1>
        <a href="/capsules/{{ rawurlencode($initData['code']) }}">重试</a>
      @endif
      @break
    @case('me')
      <h1>{{ $currentUserDto['nickname'] ?? '我的' }}</h1>
      <nav class="ssr-links" aria-label="我的">
        <a href="/me/created">我创建的</a>
        <a href="/me/favorites">我收藏的</a>
        <a href="/me/profile">账号设置</a>
      </nav>
      @if ($initData['tab'] !== 'profile')
        @include('components.server-capsule-list', ['capsules' => $initData['items']])
      @endif
      @break
    @case('open')
      <h1>开启胶囊</h1>
      @if ($initData['mySealed'])
        <h2>我封存过的胶囊</h2>
        @include('components.server-capsule-list', ['capsules' => $initData['mySealed']])
      @endif
      @break
    @case('not-found')
      <h1>查无此页</h1>
      <a href="/">返回广场</a>
      @break
    @case('about')
      <h1>关于 HelloTime Pro</h1>
      <p>{{ $uiSummary }}</p>
      @break
    @default
      <h1>{{ $title }}</h1>
  @endswitch
  @if (in_array($route, ['open', 'create', 'login', 'register', 'me'], true))
    <noscript><p>启用 JavaScript 后可以使用此页的交互功能。</p></noscript>
  @endif
</section>
