@php
  use App\Support\UiHelper;
@endphp
<div class="page page--plaza">
  <section
    class="hero"
    @pointermove="
      if ($event.pointerType === 'touch' || HT.fmt.reducedMotion() || !$refs.heroArt) return;
      const r = $el.getBoundingClientRect();
      $refs.heroArt.style.setProperty('--mx', (($event.clientX - r.left) / r.width - 0.5).toFixed(3));
      $refs.heroArt.style.setProperty('--my', (($event.clientY - r.top) / r.height - 0.5).toFixed(3));
    "
    @pointerleave="
      if (!$refs.heroArt) return;
      $refs.heroArt.style.setProperty('--mx', '0');
      $refs.heroArt.style.setProperty('--my', '0');
    "
  >
    <div class="wrap hero__in">
      <div class="hero__copy">
        <div class="overline"><i></i>HelloTime Pro · 时间胶囊</div>
        <h1 class="hero__title">
          <span class="hero__line"><span class="hero__clip"><span>把此刻，</span></span></span>
          <span class="hero__line">
            <span class="hero__clip"><span>寄给<em class="hero__future" data-text="未来">未来</em></span></span>
            <span class="seal seal--solid hero__dot" aria-hidden="true">封</span>
          </span>
        </h1>
        <p class="hero__lede">
          写下一段话，再选一个启封的时刻。<br>
          在那之前，谁也打不开它——包括你自己。
        </p>
        <div class="hero__cta">
          <a class="btn btn--primary btn--lg" href="/create" data-testid="home-create" @click="$store.feedback.goCreate($event)">
            {!! UiHelper::icon('pen') !!}
            <span>写一枚胶囊</span>
            {!! UiHelper::icon('arrow', 'ic--go') !!}
          </a>
          <a class="btn btn--ghost btn--lg" href="#plaza" @click="scrollToPlaza($event)">
            <span>逛逛胶囊广场</span>
            {!! UiHelper::icon('arrow', 'ic--go') !!}
          </a>
        </div>

        <form class="hquick" :class="opener.value.length === 8 ? 'is-full' : ''" novalidate @submit.prevent="opener.go(opener.value)">
          <div class="hquick__k">{!! UiHelper::icon('key') !!}已有胶囊码？在这里开启</div>
          <div class="hquick__row">
            @include('skins.paper._code-input', ['size' => 'sm', 'autoFocus' => false])
            <button class="hquick__go" type="submit" aria-label="开启">{!! UiHelper::icon('arrow') !!}</button>
          </div>
          <div class="hquick__err" role="alert" :data-testid="opener.error ? 'open-error' : null" x-text="opener.error"></div>
        </form>

        <div class="hero__now" aria-live="off">
          <span class="hero__now-k">此刻</span>
          <span x-text="`${HT.fmt.cn($store.clock.now)} ${HT.fmt.week($store.clock.now)}`"></span>
          <span class="mono hero__now-t" x-text="HT.fmt.time($store.clock.now, true)"></span>
          <span class="hero__lunar" x-text="HT.fmt.lunar($store.clock.now)"></span>
        </div>
      </div>

      <div class="hero__art" x-ref="heroArt">
        <div class="ha ha--letter" style="--depth:0.45" aria-hidden="true">
          <div class="ha-letter">
            <div class="ha-letter__to">致 未来 ——</div>
            <p>见字如面。</p>
            <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
            <p>但我想，你一定还记得……</p>
          </div>
        </div>
        <div class="ha ha--env" style="--depth:0.9" aria-hidden="true">
          <div class="env env--hero">
            <div class="env__back"></div>
            <div class="env__letter"></div>
            <div class="env__front">
              <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
                <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z"/>
                <path class="env__shade" d="M1 2.2 50 38 99 2.2"/>
                <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9"/>
                <path class="env__edge" d="M0 0 50 36 100 0"/>
              </svg>
            </div>
            <div class="env__flap">
              <i class="env__flap-f"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0"/></svg></i>
              <i class="env__flap-b"></i>
            </div>
            <div class="env__seal" x-html="HT.waxHtml('封')"></div>
          </div>
        </div>
        <div class="ha ha--pm" style="--depth:1.2" aria-hidden="true" x-html="HT.postmarkSvg(HT.fmt.date($store.clock.now), '此 刻', 'pm--hero')"></div>

        <template x-if="featured">
          <a class="ha ha--slip" style="--depth:1.5" :href="`/capsules/${featured.code}`" :aria-label="`广场上最受期待的胶囊：${featured.title}`">
            <div class="slip">
              <div class="slip__k"><span class="pulse-dot"></span>广场上最受期待的一枚</div>
              <div class="slip__t" x-text="featured.title"></div>
              <div class="slip__cd">
                <template x-if="HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).d > 0">
                  <span style="display:contents">
                    <b class="latin" x-text="HT.fmt.num(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).d)"></b>
                    <small>天</small>
                    <span class="mono" x-text="`${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).h)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).m)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).s)}`"></span>
                  </span>
                </template>
                <template x-if="HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).d === 0">
                  <b class="mono cap__cd-hms" x-text="`${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).h)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).m)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(featured.openAt), $store.clock.now).s)}`"></b>
                </template>
              </div>
              <div class="slip__f mono">
                <span x-text="featured.code"></span>
                <span class="slip__fav">{!! UiHelper::icon('heart') !!}<span x-text="HT.fmt.num(featured.favoriteCount)"></span></span>
              </div>
            </div>
          </a>
        </template>
      </div>
    </div>
    <div class="hero__side" aria-hidden="true">
      <span>见字如面</span><i></i><span class="latin">Est. 2026</span>
    </div>
  </section>

  <section class="wrap almanac" aria-label="广场概览" data-testid="plaza-stats">
    <template x-if="overview">
      <div style="display:contents">
        <div class="almanac__cell" data-testid="stat" data-key="all" :data-value="overview.counts.all">
          <b class="latin" x-text="HT.fmt.num(overview.counts.all)"></b>
          <span>枚胶囊<br>在广场上</span>
        </div>
        <div class="almanac__cell" data-testid="stat" data-key="unopened" :data-value="overview.counts.unopened">
          <b class="latin" x-text="HT.fmt.num(overview.counts.unopened)"></b>
          <span>枚正在<br>等待启封</span>
        </div>
        <div class="almanac__cell" data-testid="stat" data-key="opened" :data-value="overview.counts.opened">
          <b class="latin" x-text="HT.fmt.num(overview.counts.opened)"></b>
          <span>枚已经<br>被人读到</span>
        </div>
        <template x-if="farthestYear() !== null">
          <div class="almanac__cell" data-testid="stat" data-key="farthestYear" :data-value="farthestYear()">
            <b class="latin" x-text="farthestYear()"></b>
            <span>年，最远的<br>一枚才会打开</span>
          </div>
        </template>
      </div>
    </template>
  </section>

  <section class="wrap plaza" id="plaza">
    <header class="plaza__head">
      <div>
        <div class="overline"><i></i>Plaza</div>
        <h2 class="h2">胶囊广场</h2>
      </div>
      <p class="plaza__sub">别人写给未来的话。<br>有的已经启封，有的还在路上。</p>
    </header>

    <div class="toolbar">
      <div class="seg" role="group" aria-label="排序" x-data="segControl('sort')">
        <span class="seg__thumb"></span>
        <button class="seg__opt" :class="sort === 'new' ? 'is-active' : ''" type="button" :aria-pressed="sort === 'new' ? 'true' : 'false'" data-testid="sort-option" data-value="new" :data-selected="sort === 'new' ? 'true' : 'false'" @click="setSort('new')">
          {!! UiHelper::icon('clock') !!}最新
        </button>
        <button class="seg__opt" :class="sort === 'hot' ? 'is-active' : ''" type="button" :aria-pressed="sort === 'hot' ? 'true' : 'false'" data-testid="sort-option" data-value="hot" :data-selected="sort === 'hot' ? 'true' : 'false'" @click="setSort('hot')">
          {!! UiHelper::icon('fire') !!}最热
        </button>
      </div>

      <div class="seg" role="group" aria-label="筛选" x-data="segControl('filter')">
        <span class="seg__thumb"></span>
        <button class="seg__opt" :class="filter === 'all' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'all' ? 'true' : 'false'" data-testid="filter-option" data-value="all" :data-selected="filter === 'all' ? 'true' : 'false'" :data-count="counts ? counts.all : null" @click="setFilter('all')">
          全部<template x-if="counts"><sup x-text="counts.all"></sup></template>
        </button>
        <button class="seg__opt" :class="filter === 'unopened' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'unopened' ? 'true' : 'false'" data-testid="filter-option" data-value="unopened" :data-selected="filter === 'unopened' ? 'true' : 'false'" :data-count="counts ? counts.unopened : null" @click="setFilter('unopened')">
          未开启<template x-if="counts"><sup x-text="counts.unopened"></sup></template>
        </button>
        <button class="seg__opt" :class="filter === 'opened' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'opened' ? 'true' : 'false'" data-testid="filter-option" data-value="opened" :data-selected="filter === 'opened' ? 'true' : 'false'" :data-count="counts ? counts.opened : null" @click="setFilter('opened')">
          已开启<template x-if="counts"><sup x-text="counts.opened"></sup></template>
        </button>
      </div>

      <label class="search" :class="qInput ? 'has-value' : ''">
        {!! UiHelper::icon('search') !!}
        <input
          type="search"
          placeholder="搜索标题或昵称"
          autocomplete="off"
          aria-label="搜索胶囊"
          data-testid="plaza-search"
          :value="qInput"
          @input="onSearchInput($event.target.value, $event.target)"
          @keydown.escape="clearSearch(); $event.target.blur()"
        >
        <kbd>/</kbd>
        <button class="search__x" type="button" aria-label="清空搜索" @click="clearSearch()">
          {!! UiHelper::icon('x') !!}
        </button>
      </label>
    </div>

    <div class="grid" :class="loading && pagination ? 'is-busy' : ''" aria-live="polite">
      <template x-if="loading && !pagination">
        <div style="display:contents">
          @for ($si = 0; $si < 6; $si++)
            <div class="cap cap--skel" style="--i:{{ $si }}" aria-hidden="true">
              <i class="sk sk--a"></i><i class="sk sk--b"></i><i class="sk sk--c"></i><i class="sk sk--c2"></i><i class="sk sk--d"></i>
            </div>
          @endfor
        </div>
      </template>

      <template x-if="!(loading && !pagination) && error">
        <div class="empty" data-testid="list-error">
          <svg class="empty__art" viewBox="0 0 120 84" aria-hidden="true">
            <path d="M8 30 60 6l52 24v46H8z"/><path d="M8 30l52 30 52-30"/>
            <path d="M34 44V22h52v22" class="empty__art-paper"/><path d="M44 30h32M44 37h20"/>
          </svg>
          <h3>广场暂时打不开</h3>
          <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
          <button class="btn btn--ghost" type="button" data-testid="list-retry" @click="refreshAll()">
            {!! UiHelper::icon('refresh') !!}重试
          </button>
        </div>
      </template>

      <template x-if="!(loading && !pagination) && !error && !items.length && pagination">
        <div class="empty" data-testid="list-empty">
          <svg class="empty__art" viewBox="0 0 120 84" aria-hidden="true">
            <path d="M8 30 60 6l52 24v46H8z"/><path d="M8 30l52 30 52-30"/>
            <path d="M34 44V22h52v22" class="empty__art-paper"/><path d="M44 30h32M44 37h20"/>
          </svg>
          <template x-if="q.trim()">
            <div style="display:contents">
              <h3 x-text="`没有找到「${q.trim()}」`"></h3>
              <p>换个关键词试试，标题和昵称都可以搜。</p>
              <button class="btn btn--ghost" type="button" @click="clearSearch()">清空搜索</button>
            </div>
          </template>
          <template x-if="!q.trim()">
            <div style="display:contents">
              <h3>广场上还没有胶囊</h3>
              <p>来当第一个写信给未来的人？</p>
              <a class="btn btn--primary" href="/create" @click="$store.feedback.goCreate($event)">
                {!! UiHelper::icon('pen') !!}写一枚胶囊
              </a>
            </div>
          </template>
        </div>
      </template>

      <template x-if="!(loading && !pagination) && !error && items.length">
        <div style="display:contents">
          <template x-for="(c, idx) in items" :key="c.id">
            @include('skins.paper._card')
          </template>
        </div>
      </template>
    </div>

    <nav class="pager" aria-label="分页">
      <template x-if="pagination && items.length && pagination.totalPages <= 1">
        <div class="pager__sum" x-text="`共 ${HT.fmt.num(pagination.total)} 枚`"></div>
      </template>
      <template x-if="pagination && items.length && pagination.totalPages > 1">
        <div style="display:contents">
          <button class="pager__nav" type="button" :disabled="pagination.page <= 1" @click="setPage(pagination.page - 1)">
            {!! UiHelper::icon('chev-left') !!}上一页
          </button>
          <div class="pager__nums">
            <template x-for="(n, pi) in pages()" :key="`${pi}-${n}`">
              <div style="display:contents">
                <template x-if="n === '…'">
                  <span class="pager__gap">…</span>
                </template>
                <template x-if="n !== '…'">
                  <button class="pager__n latin" :class="n === pagination.page ? 'is-active' : ''" type="button" :aria-current="n === pagination.page ? 'page' : null" @click="setPage(n)" x-text="n"></button>
                </template>
              </div>
            </template>
          </div>
          <button class="pager__nav" type="button" :disabled="pagination.page >= pagination.totalPages" :data-testid="pagination.page < pagination.totalPages ? 'plaza-next' : null" @click="setPage(pagination.page + 1)">
            下一页{!! UiHelper::icon('chev-right') !!}
          </button>
          <div class="pager__sum" x-text="`共 ${HT.fmt.num(pagination.total)} 枚 · 第 ${pagination.page} / ${pagination.totalPages} 页`"></div>
        </div>
      </template>
    </nav>
  </section>
</div>
