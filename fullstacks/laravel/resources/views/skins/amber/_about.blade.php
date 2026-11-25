@php
  use App\Support\UiHelper;
@endphp
<div class="page page--about">
  <div class="container about">
    <header class="about__hero">
      <div class="about__badge">
        <span class="about__ring"></span>
        <svg class="logo" width="112" height="112" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="ala-n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34267e"/><stop offset="1" stop-color="#0a0e28"/></linearGradient>
            <linearGradient id="ala-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe59a"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>
            <linearGradient id="ala-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d1ff"/></linearGradient>
            <radialGradient id="ala-w" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#ala-n)"/>
          <circle cx="32" cy="32" r="24" fill="url(#ala-w)"/>
          <g transform="rotate(45 32 32)">
            <path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 3.4"/>
            <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill="url(#ala-a)"/>
            <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill="url(#ala-g)"/>
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
      </div>
      <div>
        <div class="eyebrow">About</div>
        <h1 class="about__title">
          HelloTime Pro <span class="pill mono">v2.0</span>
        </h1>
        <p class="about__motto">有些话，要等一等再说。</p>
        <p class="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
      </div>
    </header>

    <section class="about__sec">
      <div class="eyebrow">Tech stack</div>
      <h2 class="section-title">此刻运行的技术栈</h2>
      <p class="page-lead">页脚与这里展示的内容，均来自本全栈同源的健康检查接口——页面与 API 由同一套服务提供。</p>
      <div class="about__live">
        <span class="ftr__dot"></span>
        服务在线 · <span class="mono">GET /api/v1/health</span>
      </div>
      <div class="about__stacks" data-testid="about-stack">
        <article class="card card--pad stack-card">
          <div class="eyebrow">Interface</div>
          <h2 class="card__title">
            界面层 · Blade + Alpine.js
            <small class="mono">fullstacks/laravel</small>
          </h2>
          <p class="card__lead">{{ $uiSummary }}</p>
          <ul class="stack-list">
            @foreach($uiStack as $it)
              <li data-testid="stack-item" data-name="{{ $it['name'] }}">
                <span class="stack-list__ic">
                  @if(!empty($it['iconUrl']))
                    <img class="tech-ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
                  @else
                    <span class="tech-ic tech-ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
                  @endif
                </span>
                <div>
                  <b>
                    {{ $it['name'] }}
                    <small class="mono">{{ $it['version'] }}</small>
                  </b>
                  <span>{{ $techNotes[$it['name']] ?? '' }}</span>
                </div>
                <em>{{ $roleLabels[$it['role']] ?? $it['role'] }}</em>
              </li>
            @endforeach
          </ul>
        </article>

        <article class="card card--pad stack-card">
          <div class="eyebrow">Server</div>
          <h2 class="card__title">
            服务端 · Laravel
            <small class="mono">fullstack</small>
          </h2>
          <p class="card__lead">{{ $serverSummary }}</p>
          <ul class="stack-list">
            @foreach($serverStack as $it)
              <li data-testid="stack-item" data-name="{{ $it['name'] }}">
                <span class="stack-list__ic">
                  @if(!empty($it['iconUrl']))
                    <img class="tech-ic" src="{{ $it['iconUrl'] }}" alt="" loading="lazy">
                  @else
                    <span class="tech-ic tech-ic--txt" aria-hidden="true">{{ mb_substr($it['name'], 0, 2) }}</span>
                  @endif
                </span>
                <div>
                  <b>
                    {{ $it['name'] }}
                    <small class="mono">{{ $it['version'] }}</small>
                  </b>
                  <span>{{ $techNotes[$it['name']] ?? '' }}</span>
                </div>
                <em>{{ $roleLabels[$it['role']] ?? $it['role'] }}</em>
              </li>
            @endforeach
          </ul>
        </article>
      </div>
    </section>

    <section class="about__sec">
      <div class="eyebrow">Features</div>
      <h2 class="section-title">它能做什么</h2>
      <div class="features" data-testid="about-features">
        @foreach($features as $i => $feat)
          <article class="feature card" style="--i:{{ $i }}" data-testid="about-feature">
            <span class="feature__ic">{!! UiHelper::icon($feat[0]) !!}</span>
            <h3>{{ $feat[1] }}</h3>
            <p>{{ $feat[2] }}</p>
          </article>
        @endforeach
      </div>
    </section>

    <section class="about__sec card card--pad dnotes">
      <div class="eyebrow">Principles</div>
      <h2 class="section-title">四条原则</h2>
      <p class="card__lead">这个仓库为什么长成现在的样子。</p>
      <div class="dnotes__grid dnotes__grid--4" data-testid="about-tenets">
        @foreach($tenets as $tenet)
          <div data-testid="about-tenet">
            <h3>{{ $tenet[0] }}</h3>
            <p>{!! $tenet[1] !!}</p>
          </div>
        @endforeach
      </div>
    </section>

    <section class="about__sec about__credits">
      <div>
        <h3>{!! UiHelper::icon('code') !!}源码</h3>
        <p>实现位于仓库的 <code class="mono">fullstacks/laravel</code> 目录。</p>
      </div>
      <div>
        <h3>{!! UiHelper::icon('heart') !!}致谢</h3>
        <p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p>
      </div>
      <div>
        <h3>{!! UiHelper::icon('book') !!}许可</h3>
        <p>MIT License。本项目用于教学与研究，不面向生产环境。</p>
      </div>
    </section>
  </div>
</div>
