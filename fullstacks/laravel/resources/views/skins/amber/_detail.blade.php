@php
  use App\Support\UiHelper;
@endphp
<div class="page page--detail">
  <div
    class="container detail"
    :data-testid="c ? 'capsule-detail' : null"
    :data-code="c ? c.code : null"
    :data-state="c ? (isOpenedView ? 'opened' : 'sealed') : null"
    :data-in-plaza="c ? (c.inPlaza ? 'true' : 'false') : null"
  >
    {{-- 加载失败 --}}
    <template x-if="status === 'error'">
      <div class="notice card" role="alert">
        <p>暂时无法加载这枚胶囊，请稍后重试。</p>
        <button class="btn btn--ghost" type="button" @click="reload()">重试</button>
      </div>
    </template>

    {{-- 查无此胶囊 --}}
    <template x-if="status === 'missing'">
      <div class="notice card" data-testid="detail-not-found">
        <div style="display:contents" x-html="HT.capsuleArtSvg('LOST0000', 'opened', 200, 'notice__art')"></div>
        <div class="eyebrow">Not found</div>
        <h1 class="page-title">找不到这枚胶囊</h1>
        <p class="page-lead">
          <template x-if="code">
            <span>没有胶囊码为 <b class="mono" x-text="code.toUpperCase()"></b> 的胶囊。</span>
          </template>
          <template x-if="!code">
            <span>这枚胶囊不存在。</span>
          </template>
          也许是码抄错了一位，也许它已经被作者删除了。
        </p>
        <div class="notice__act">
          <a class="btn btn--primary" href="/open">{!! UiHelper::icon('key') !!}重新输入胶囊码</a>
          <a class="btn btn--ghost" href="/">回到广场</a>
        </div>
      </div>
    </template>

    {{-- 开启中动画 --}}
    <template x-if="c && amberPhase">
      <div class="opening" :class="amberPhase === 'open' ? 'is-open' : ''">
        <div class="opening__burst"></div>
        <div class="opening__capsule" x-html="HT.capsuleArtSvg(c.code, amberPhase === 'open' ? 'opened' : 'locked', 300)"></div>
        <p class="opening__text">时间到了，正在开启……</p>
      </div>
    </template>

    {{-- 已开启：信笺 --}}
    <template x-if="c && !amberPhase && isOpenedView">
      <div style="display:contents">
        <a class="back" href="/">{!! UiHelper::icon('arrow-left') !!}返回广场</a>
        <div class="letter-page" :class="reveal ? 'is-reveal' : ''">
          <article class="letter">
            <div class="letter__meta">
              <span class="mono" x-text="c.code"></span>
              <i></i>
              <template x-if="c.inPlaza">
                <span class="badge badge--plaza">{!! UiHelper::icon('globe') !!}广场公开</span>
              </template>
              <template x-if="!c.inPlaza">
                <span class="badge badge--private">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
              </template>
            </div>
            <h1 class="letter__title" data-testid="detail-title" x-text="c.title"></h1>
            <div class="letter__from">
              <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
              <span x-text="`${c.creator.nickname} 写于 ${HT.fmt.cn(createdAtMs)}`"></span>
            </div>
            <div class="letter__body" data-testid="detail-content">
              <template x-for="(para, pi) in HT.fmt.paragraphs(c.content)" :key="pi">
                <p :style="`--i:${pi}`" style="white-space:pre-line" x-text="para"></p>
              </template>
            </div>
            <footer class="letter__foot">
              <div class="letter__span">
                <div>{!! UiHelper::icon('hourglass') !!}这封信在时间里沉睡了 <b x-text="HT.fmt.span(openAtMs - createdAtMs)"></b></div>
                <span class="mono" x-text="`${HT.fmt.dashDateTime(createdAtMs)} 封存 → ${HT.fmt.dashDateTime(openAtMs)} 开启`"></span>
              </div>
              <div class="letter__sign">
                <svg class="stamp" viewBox="0 0 140 140" aria-hidden="true">
                  <defs><path id="amber-stamp-arc" d="M18 70a52 52 0 1 1 104 0a52 52 0 1 1-104 0"/></defs>
                  <circle class="stamp__ring" cx="70" cy="70" r="66"/>
                  <circle class="stamp__ring stamp__ring--in" cx="70" cy="70" r="40"/>
                  <text class="stamp__arc"><textPath href="#amber-stamp-arc" textLength="316" lengthAdjust="spacing">HELLOTIME PRO · 时间胶囊 · TIME CAPSULE ·</textPath></text>
                  <text class="stamp__label" x="70" y="68" text-anchor="middle">已开启</text>
                  <text class="stamp__date" x="70" y="86" text-anchor="middle" x-text="HT.fmt.date(openAtMs)"></text>
                </svg>
                <span x-text="`—— ${c.creator.nickname}`"></span>
              </div>
            </footer>
          </article>
          <div class="detail__actions">
            @include('components.fav-button', ['capExpr' => 'c', 'size' => 'md'])
            <button class="btn btn--ghost" type="button" data-testid="copy-code" @click="copyCode()">
              {!! UiHelper::icon('copy') !!}复制胶囊码
            </button>
            <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink()">
              {!! UiHelper::icon('link') !!}分享链接
            </button>
            <a class="btn btn--primary" href="/create" @click="$store.feedback.goCreate($event)">
              {!! UiHelper::icon('pen') !!}我也写一枚
            </a>
          </div>
          <template x-if="!c.inPlaza">
            <p class="tip tip--quiet">
              {!! UiHelper::icon('lock') !!}
              <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
            </p>
          </template>
        </div>
      </div>
    </template>

    {{-- 封存中：进度环 + 翻牌倒计时 --}}
    <template x-if="c && !amberPhase && !isOpenedView">
      <div style="display:contents">
        <a class="back" href="/">{!! UiHelper::icon('arrow-left') !!}返回广场</a>
        <section class="vault card" :style="`--glow:${HT.paletteOf(c.code).glow}`">
          <div class="vault__dial">
            <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
              <circle class="vault__track" cx="170" cy="170" r="150"/>
              <circle class="vault__arc" cx="170" cy="170" r="150" :style="`stroke-dasharray:${ringDash}`"/>
            </svg>
            <div class="vault__art" x-html="HT.capsuleArtSvg(c.code, 'locked', 220)"></div>
            <div class="vault__pct">
              <b class="mono" x-text="`${waitPct.toFixed(2)}%`"></b>
              <span>时间已经走过</span>
            </div>
          </div>
          <div class="vault__info">
            <div class="badges">
              <span class="badge badge--locked">{!! UiHelper::icon('lock') !!}封存中</span>
              <template x-if="c.inPlaza">
                <span class="badge badge--plaza">{!! UiHelper::icon('globe') !!}广场公开</span>
              </template>
              <template x-if="!c.inPlaza">
                <span class="badge badge--private">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
              </template>
            </div>
            <h1 class="vault__title" data-testid="detail-title" x-text="c.title"></h1>
            <div class="vault__by">
              <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
              <span>来自 <b x-text="c.creator.nickname"></b> · 封存于 <span x-text="HT.fmt.cn(createdAtMs)"></span></span>
            </div>
            <div class="vault__k">距离开启还有</div>
            <div data-testid="countdown" :data-open-at="c.openAt">
              <div class="cd" role="timer" :aria-label="`距离开启还有 ${cd.d} 天 ${cd.h} 小时 ${cd.m} 分 ${cd.s} 秒`">
                <div class="cd__unit">
                  <div class="cd__digits">
                    <template x-for="(d, j) in Array.from(String(cd.d).padStart(2, '0'))" :key="`d-${j}`">
                      <span class="cd__digit" x-text="d"></span>
                    </template>
                  </div>
                  <div class="cd__label">天</div>
                </div>
                <div class="cd__sep" aria-hidden="true">:</div>
                <div class="cd__unit">
                  <div class="cd__digits">
                    <template x-for="(d, j) in Array.from(HT.fmt.pad2(cd.h))" :key="`h-${j}`">
                      <span class="cd__digit" x-text="d"></span>
                    </template>
                  </div>
                  <div class="cd__label">时</div>
                </div>
                <div class="cd__sep" aria-hidden="true">:</div>
                <div class="cd__unit">
                  <div class="cd__digits">
                    <template x-for="(d, j) in Array.from(HT.fmt.pad2(cd.m))" :key="`m-${j}`">
                      <span class="cd__digit" x-text="d"></span>
                    </template>
                  </div>
                  <div class="cd__label">分</div>
                </div>
                <div class="cd__sep" aria-hidden="true">:</div>
                <div class="cd__unit cd__unit--accent">
                  <div class="cd__digits">
                    <template x-for="(d, j) in Array.from(HT.fmt.pad2(cd.s))" :key="`s-${j}`">
                      <span class="cd__digit" x-text="d"></span>
                    </template>
                  </div>
                  <div class="cd__label">秒</div>
                </div>
              </div>
            </div>
            <dl class="vault__meta">
              <div><dt>{!! UiHelper::icon('calendar') !!}开启时间</dt><dd class="mono" x-text="HT.fmt.dashDateTime(openAtMs)"></dd></div>
              <div><dt>{!! UiHelper::icon('key') !!}胶囊码</dt><dd class="mono" x-text="c.code"></dd></div>
              <div><dt>{!! UiHelper::icon('heart') !!}在等它的人</dt><dd class="mono" x-text="HT.fmt.num(c.favoriteCount)"></dd></div>
            </dl>
            <p class="tip">
              {!! UiHelper::icon('sparkle') !!}
              <span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span>
            </p>
            <div class="detail__actions">
              @include('components.fav-button', ['capExpr' => 'c', 'size' => 'md'])
              <button class="btn btn--ghost" type="button" data-testid="copy-code" @click="copyCode()">
                {!! UiHelper::icon('copy') !!}复制胶囊码
              </button>
              <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink()">
                {!! UiHelper::icon('link') !!}分享链接
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</div>
