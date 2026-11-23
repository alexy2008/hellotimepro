@php
  use App\Support\UiHelper;
  $y0 = (int) date('Y');
  $yearsText = implode(' · ', range($y0, $y0 + 20)) . ' · ';
  $sparks = [[72, 96, 14], [522, 90, 9], [550, 452, 12], [60, 474, 8], [404, 226, 6]];
  $sparkPath = function ($cx, $cy, $r) {
    $k = $r * 0.14;
    return "M{$cx} " . ($cy - $r) . "Q" . ($cx + $k) . " " . ($cy - $k) . " " . ($cx + $r) . " {$cy}Q" . ($cx + $k) . " " . ($cy + $k) . " {$cx} " . ($cy + $r) . "Q" . ($cx - $k) . " " . ($cy + $k) . " " . ($cx - $r) . " {$cy}Q" . ($cx - $k) . " " . ($cy - $k) . " {$cx} " . ($cy - $r) . "Z";
  };
@endphp
<div class="page page--home">
  <section class="hero container">
    <div class="hero__copy">
      <div class="eyebrow">HelloTime Pro · 时间胶囊</div>
      <h1 class="hero__title">
        <span class="hero__line">把此刻，</span>
        <span class="hero__line">寄给<em class="hero__future">未来</em>。</span>
      </h1>
      <p class="hero__lede">
        写下一段话，选定一个未来的时刻，把它封进胶囊。<br>
        在那之前，谁也读不到——包括你自己。
      </p>
      <div class="hero__cta">
        <a class="btn btn--primary btn--lg" href="/create" data-testid="home-create" @click="$store.feedback.goCreate($event)">
          {!! UiHelper::icon('pen') !!}写一枚胶囊
        </a>
        <a class="btn btn--ghost btn--lg" href="#plaza" @click="scrollToPlaza($event)">
          逛逛胶囊广场{!! UiHelper::icon('arrow', 'ic--go') !!}
        </a>
      </div>

      <form class="quick card" novalidate @submit.prevent="opener.go(opener.value)">
        <div class="quick__k">{!! UiHelper::icon('key') !!}已有胶囊码？在这里开启</div>
        <div class="quick__row">
          @include('skins.amber._code-input', ['size' => 'md', 'autoFocus' => false])
          <button class="btn btn--soft" type="submit">开启{!! UiHelper::icon('arrow') !!}</button>
        </div>
        <div class="quick__err" role="alert" :data-testid="opener.error ? 'open-error' : null" x-text="opener.error"></div>
      </form>

      <div class="hero__now">
        <span class="hero__live"></span>
        此刻 · <span class="mono" x-text="`${HT.fmt.date($store.clock.now).replace(/\./g, '-')} ${HT.fmt.time($store.clock.now, true)}`"></span>
      </div>
    </div>

    <div class="hero__art">
      <div
        class="hart"
        aria-hidden="true"
        x-data="{
          raf: 0,
          init() {
            if (HT.fmt.reducedMotion()) return;
            this._onMove = (e) => {
              cancelAnimationFrame(this.raf);
              this.raf = requestAnimationFrame(() => {
                const r = this.$el.getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
                const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
                this.$el.style.setProperty('--tilt-x', (-dy * 14).toFixed(2) + 'deg');
                this.$el.style.setProperty('--tilt-y', (dx * 16).toFixed(2) + 'deg');
              });
            };
            window.addEventListener('mousemove', this._onMove, { passive: true });
          },
          destroy() {
            if (this._onMove) window.removeEventListener('mousemove', this._onMove);
            cancelAnimationFrame(this.raf);
          }
        }"
      >
        <svg class="hart__svg" viewBox="0 0 600 600">
          <defs>
            <radialGradient id="hHalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".4"/><stop offset=".55" stop-color="#8f7dff" stop-opacity=".12"/><stop offset="1" stop-color="#8f7dff" stop-opacity="0"/></radialGradient>
            <linearGradient id="hMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2c2"/><stop offset=".22" stop-color="#ffc65c"/><stop offset=".6" stop-color="#f6902c"/><stop offset=".86" stop-color="#d9641a"/><stop offset="1" stop-color="#ffb45a"/></linearGradient>
            <linearGradient id="hSeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4ec2"/><stop offset=".3" stop-color="#2c2674"/><stop offset="1" stop-color="#120f38"/></linearGradient>
            <radialGradient id="hCore" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c9" stop-opacity=".95"/><stop offset=".38" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
            <linearGradient id="hArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff7b4a"/></linearGradient>
            <clipPath id="hGlassClip"><path d="M238 300V388A62 62 0 0 0 362 388V300Z"/></clipPath>
            <path id="hYearPath" d="M68 300a232 232 0 1 1 464 0a232 232 0 1 1-464 0"/>
          </defs>
          <circle class="hart__halo" cx="300" cy="300" r="260" fill="url(#hHalo)"/>
          <g class="hart__ring hart__ring--outer">
            <circle class="hart__ticks" cx="300" cy="300" r="278"/>
            <circle class="hart__planet hart__planet--amber" cx="300" cy="22" r="5.5"/>
            <circle class="hart__planet hart__planet--cyan" cx="496.6" cy="496.6" r="3.6"/>
          </g>
          <g class="hart__ring hart__ring--years">
            <text class="hart__years"><textPath href="#hYearPath" textLength="1440" lengthAdjust="spacing">{{ $yearsText }}</textPath></text>
          </g>
          <g class="hart__ring hart__ring--mid">
            <circle class="hart__line" cx="300" cy="300" r="204"/>
            <circle class="hart__major" cx="300" cy="300" r="204"/>
            <circle class="hart__planet hart__planet--violet" cx="96" cy="300" r="7"/>
          </g>
          <g class="hart__ring hart__ring--inner">
            <circle class="hart__dash" cx="300" cy="300" r="162"/>
            <circle class="hart__arc" cx="300" cy="300" r="162" stroke="url(#hArc)"/>
          </g>
          <ellipse class="hart__shadow" cx="300" cy="492" rx="96" ry="12"/>
          <g class="hart__capsule">
            <g transform="rotate(26 300 300)">
              <path class="hart__glass" d="M238 300V388A62 62 0 0 0 362 388V300Z"/>
              <g clip-path="url(#hGlassClip)">
                <circle class="hart__core" cx="300" cy="372" r="84" fill="url(#hCore)"/>
                <rect class="hart__scroll" x="270" y="322" width="60" height="94" rx="9"/>
                <path class="hart__scroll-line" d="M282 342h36M282 354h36M282 366h22"/>
                <rect class="hart__ribbon" x="270" y="382" width="60" height="11"/>
                <circle class="hart__wax" cx="300" cy="387.5" r="8.5"/>
              </g>
              <path class="hart__reflection" d="M254 316V386A46 46 0 0 0 268 420"/>
              <path d="M238 300V212A62 62 0 0 1 362 212V300Z" fill="url(#hMetal)"/>
              <path class="hart__groove" d="M238 268h124M238 280h124"/>
              <circle class="hart__emblem" cx="300" cy="216" r="24"/>
              <path class="hart__hand" d="M300 202v14l9 6"/>
              <path class="hart__highlight" d="M256 284V214A44 44 0 0 1 280 176"/>
              <rect x="230" y="291" width="140" height="18" rx="9" fill="url(#hSeam)"/>
              <path class="hart__seam-light" d="M242 296h116"/>
            </g>
          </g>
          @foreach($sparks as $si => [$sx, $sy, $sr])
            <path class="hart__spark" style="animation-delay:{{ -$si * 0.7 }}s" d="{{ $sparkPath($sx, $sy, $sr) }}"/>
          @endforeach
        </svg>
      </div>

      <template x-if="featured">
        <a class="slip" :href="`/capsules/${featured.code}`" :style="`--glow:${HT.paletteOf(featured.code).glow}`">
          <div class="slip__k"><span class="slip__dot"></span>广场上最受期待的一枚</div>
          <div class="slip__row">
            <span style="display:contents" x-html="HT.capsuleArtSvg(featured.code, 'locked', 64)"></span>
            <div>
              <b class="slip__t" x-text="featured.title"></b>
              <span class="slip__cd mono" x-text="HT.fmt.cdAmber(HT.fmt.ms(featured.openAt), $store.clock.now)"></span>
            </div>
          </div>
          <div class="slip__f">{!! UiHelper::icon('heart') !!}<span x-text="`${HT.fmt.num(featured.favoriteCount)} 人在等它`"></span></div>
        </a>
      </template>
    </div>
  </section>

  <section class="container stats" aria-label="广场概览" data-testid="plaza-stats">
    <template x-if="overview">
      <div style="display:contents">
        <div class="stats__cell" style="--i:0" data-testid="stat" data-key="all" :data-value="overview.counts.all">
          <b class="mono" x-text="overview.counts.all"></b>
          <span>枚胶囊<br>在广场上</span>
        </div>
        <div class="stats__cell" style="--i:1" data-testid="stat" data-key="unopened" :data-value="overview.counts.unopened">
          <b class="mono" x-text="overview.counts.unopened"></b>
          <span>枚正在<br>等待开启</span>
        </div>
        <div class="stats__cell" style="--i:2" data-testid="stat" data-key="opened" :data-value="overview.counts.opened">
          <b class="mono" x-text="overview.counts.opened"></b>
          <span>枚已经<br>被人读到</span>
        </div>
        <template x-if="farthestYear() !== null">
          <div class="stats__cell" style="--i:3" data-testid="stat" data-key="farthestYear" :data-value="farthestYear()">
            <b class="mono" x-text="farthestYear()"></b>
            <span>年，最远的<br>一枚才会打开</span>
          </div>
        </template>
      </div>
    </template>
  </section>

  <section class="container plaza" id="plaza">
    <header class="page-head page-head--split">
      <div>
        <div class="eyebrow">Capsule Plaza</div>
        <h2 class="page-title">胶囊广场</h2>
        <p class="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
      </div>
      <a class="btn btn--primary" href="/create" @click="$store.feedback.goCreate($event)">
        {!! UiHelper::icon('pen') !!}我也放一枚
      </a>
    </header>

    <div class="toolbar card">
      <label class="search input-wrap" :class="qInput ? 'has-value' : ''">
        {!! UiHelper::icon('search', 'input-wrap__icon') !!}
        <input
          class="input"
          type="search"
          placeholder="搜索标题或昵称…"
          autocomplete="off"
          aria-label="搜索胶囊"
          data-testid="plaza-search"
          :value="qInput"
          @input="onSearchInput($event.target.value, $event.target)"
          @keydown.escape="clearSearch(); $event.target.blur()"
        >
        <kbd class="kbd">/</kbd>
        <button class="search__x icon-btn" type="button" aria-label="清空搜索" @click="clearSearch()">
          {!! UiHelper::icon('x') !!}
        </button>
      </label>

      <div class="seg" role="group" aria-label="筛选" x-data="segControl('filter')">
        <span class="seg__thumb"></span>
        <button class="seg__opt" :class="filter === 'all' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'all' ? 'true' : 'false'" data-testid="filter-option" data-value="all" :data-selected="filter === 'all' ? 'true' : 'false'" :data-count="counts ? counts.all : null" @click="setFilter('all')">
          全部<template x-if="counts"><sup x-text="counts.all"></sup></template>
        </button>
        <button class="seg__opt" :class="filter === 'unopened' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'unopened' ? 'true' : 'false'" data-testid="filter-option" data-value="unopened" :data-selected="filter === 'unopened' ? 'true' : 'false'" :data-count="counts ? counts.unopened : null" @click="setFilter('unopened')">
          封存中<template x-if="counts"><sup x-text="counts.unopened"></sup></template>
        </button>
        <button class="seg__opt" :class="filter === 'opened' ? 'is-active' : ''" type="button" :aria-pressed="filter === 'opened' ? 'true' : 'false'" data-testid="filter-option" data-value="opened" :data-selected="filter === 'opened' ? 'true' : 'false'" :data-count="counts ? counts.opened : null" @click="setFilter('opened')">
          已开启<template x-if="counts"><sup x-text="counts.opened"></sup></template>
        </button>
      </div>

      <div class="select">
        <select aria-label="排序" data-testid="plaza-sort" x-effect="$el.value = sort" @change="setSort($event.target.value)">
          <option value="new">最新封存</option>
          <option value="hot">最多收藏</option>
        </select>
        {!! UiHelper::icon('chev-down', 'select__arrow') !!}
      </div>
    </div>

    <div class="plaza__count">
      <template x-if="pagination">
        <span>共 <b x-text="HT.fmt.num(pagination.total)"></b> 枚胶囊<span x-text="q.trim() ? ` · 关键词「${q.trim()}」` : ''"></span></span>
      </template>
    </div>

    <div class="grid" :class="loading && pagination ? 'is-busy' : ''" aria-live="polite">
      <template x-if="loading && !pagination">
        <div style="display:contents">
          @for ($si = 0; $si < 6; $si++)
            <div class="pc pc--skel" style="--i:{{ $si }}" aria-hidden="true">
              <i class="sk" style="width:150px;height:62px;border-radius:999px"></i>
              <i class="sk" style="width:70%;height:22px;margin-top:30px"></i>
              <i class="sk" style="width:45%;height:13px;margin-top:12px"></i>
              <i class="sk" style="width:100%;height:13px;margin-top:22px"></i>
              <i class="sk" style="width:82%;height:13px;margin-top:10px"></i>
              <i class="sk" style="width:100%;height:13px;margin-top:30px"></i>
            </div>
          @endfor
        </div>
      </template>

      <template x-if="!(loading && !pagination) && error">
        <div class="empty" data-testid="list-error">
          <div style="display:contents" x-html="HT.capsuleArtSvg(null, 'opened', 170, 'empty__art')"></div>
          <h3 class="empty__title">广场暂时打不开</h3>
          <p>没能连上后端。请确认服务已启动，或稍后再试。</p>
          <button class="btn btn--ghost" type="button" data-testid="list-retry" @click="refreshAll()">
            {!! UiHelper::icon('refresh') !!}重试
          </button>
        </div>
      </template>

      <template x-if="!(loading && !pagination) && !error && !items.length && pagination">
        <div class="empty" data-testid="list-empty">
          <div style="display:contents" x-html="HT.capsuleArtSvg(null, 'opened', 170, 'empty__art')"></div>
          <template x-if="q.trim()">
            <div style="display:contents">
              <h3 class="empty__title" x-text="`没有找到「${q.trim()}」`"></h3>
              <p>换个关键词试试，标题和昵称都可以搜。</p>
              <button class="btn btn--ghost" type="button" @click="clearSearch()">清空搜索</button>
            </div>
          </template>
          <template x-if="!q.trim()">
            <div style="display:contents">
              <h3 class="empty__title">广场上还没有胶囊</h3>
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
            @include('skins.amber._card')
          </template>
        </div>
      </template>
    </div>

    <nav class="pager" aria-label="分页">
      <template x-if="pagination && pagination.totalPages > 1 && items.length">
        <div style="display:contents">
          <button class="pager__btn" type="button" :disabled="pagination.page <= 1" aria-label="上一页" @click="setPage(pagination.page - 1)">
            {!! UiHelper::icon('chev-left') !!}
          </button>
          <template x-for="(n, pi) in pages()" :key="`${pi}-${n}`">
            <div style="display:contents">
              <template x-if="n === '…'">
                <span class="pager__gap">…</span>
              </template>
              <template x-if="n !== '…'">
                <button class="pager__btn" :class="n === pagination.page ? 'is-active' : ''" type="button" :aria-current="n === pagination.page ? 'page' : null" @click="setPage(n)" x-text="n"></button>
              </template>
            </div>
          </template>
          <button class="pager__btn" type="button" :disabled="pagination.page >= pagination.totalPages" aria-label="下一页" :data-testid="pagination.page < pagination.totalPages ? 'plaza-next' : null" @click="setPage(pagination.page + 1)">
            {!! UiHelper::icon('chev-right') !!}
          </button>
        </div>
      </template>
    </nav>
  </section>
</div>
