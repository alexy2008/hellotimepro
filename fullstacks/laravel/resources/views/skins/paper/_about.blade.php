@php
  use App\Support\UiHelper;
@endphp
<div class="page page--about">
  <div class="wrap about">
    <header class="about__hero">
      <div class="overline">
        <i></i>
        About
      </div>
      <h1 class="about__title">
        <span>有些话，</span>
        <span>
          要<em>等一等</em>再说<i class="about__stop"></i>
        </span>
      </h1>
      <div class="about__lede">
        <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
        <p>
          它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的界面层与服务端同源实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。
        </p>
      </div>
    </header>

    <section class="about__sec">
      <header class="sechead">
        <span class="sechead__no">壹</span>
        <div>
          <h2 class="h2">此刻运行的技术栈</h2>
          <p>页脚与这里展示的内容，均来自本全栈同源的健康检查接口——页面与 API 由同一套服务提供。</p>
        </div>
      </header>
      <div class="about__live">
        <span class="dot dot--on"></span>
        服务在线
        <i></i>
        <span class="mono">GET /api/v1/health</span>
      </div>
      <div class="about__stack" data-testid="about-stack">
        <article class="spec">
          <header class="spec__head">
            <div>
              <div class="spec__k">界面层</div>
              <h3 class="spec__t serif">Blade + Alpine.js</h3>
            </div>
            <span class="spec__sub mono">fullstacks/laravel</span>
          </header>
          <ul class="spec__list">
            @foreach($uiStack as $it)
              <li class="tech" data-testid="stack-item" data-name="{{ $it['name'] }}">
                @if(!empty($it['iconUrl']))
                  <img class="tech__ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
                @else
                  <span class="tech__ic tech__ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
                @endif
                <div class="tech__main">
                  <b>
                    {{ $it['name'] }}
                    <small class="mono">{{ $it['version'] }}</small>
                  </b>
                  <span>{{ $techNotes[$it['name']] ?? '' }}</span>
                </div>
                <em class="tech__role">{{ $roleLabels[$it['role']] ?? $it['role'] }}</em>
              </li>
            @endforeach
          </ul>
          <p class="spec__sum">{{ $uiSummary }}</p>
        </article>

        <article class="spec">
          <header class="spec__head">
            <div>
              <div class="spec__k">服务端</div>
              <h3 class="spec__t serif">Laravel</h3>
            </div>
            <span class="spec__sub mono">fullstack</span>
          </header>
          <ul class="spec__list">
            @foreach($serverStack as $it)
              <li class="tech" data-testid="stack-item" data-name="{{ $it['name'] }}">
                @if(!empty($it['iconUrl']))
                  <img class="tech__ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
                @else
                  <span class="tech__ic tech__ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
                @endif
                <div class="tech__main">
                  <b>
                    {{ $it['name'] }}
                    <small class="mono">{{ $it['version'] }}</small>
                  </b>
                  <span>{{ $techNotes[$it['name']] ?? '' }}</span>
                </div>
                <em class="tech__role">{{ $roleLabels[$it['role']] ?? $it['role'] }}</em>
              </li>
            @endforeach
          </ul>
          <p class="spec__sum">{{ $serverSummary }}</p>
        </article>
      </div>
    </section>

    <section class="about__sec">
      <header class="sechead">
        <span class="sechead__no">贰</span>
        <div>
          <h2 class="h2">它能做什么</h2>
          <p>一枚胶囊从写下到被读到，会经过的每一步。</p>
        </div>
      </header>
      <ol class="feats" data-testid="about-features">
        @foreach($features as $i => $feat)
          <li style="--i:{{ $i }}" data-testid="about-feature">
            <span class="feats__no latin">{{ str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) }}</span>
            <b class="serif">{{ $feat[1] }}</b>
            <p>{{ $feat[2] }}</p>
          </li>
        @endforeach
      </ol>
    </section>

    <section class="about__sec">
      <header class="sechead">
        <span class="sechead__no">叁</span>
        <div>
          <h2 class="h2">四条原则</h2>
          <p>这个仓库为什么长成现在的样子。</p>
        </div>
      </header>
      <ol class="tenets" data-testid="about-tenets">
        @foreach($tenets as $tenet)
          <li data-testid="about-tenet">
            <b class="serif">{{ $tenet[0] }}</b>
            <p>{!! $tenet[1] !!}</p>
          </li>
        @endforeach
      </ol>
    </section>

    <section class="about__sec about__sec--end">
      <div class="credits">
        <div>
          <h3 class="serif">源码</h3>
          <p>
            全部实现都在同一个仓库里，按 <code class="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录；这一套在 <code class="mono">fullstacks/laravel</code>。
          </p>
        </div>
        <div>
          <h3 class="serif">致谢</h3>
          <p>技术栈图标来自 Simple Icons 与各项目官方标识；字体来自思源宋体、Cormorant Garamond 与 IBM Plex Mono；感谢每一个开源框架的作者与维护者。</p>
        </div>
        <div>
          <h3 class="serif">许可</h3>
          <p>MIT License。本项目用于教学、对比与研究，不面向生产环境。</p>
        </div>
      </div>
    </section>
  </div>
</div>
