@php
  use App\Support\UiHelper;
@endphp
<div class="page page--detail">
  <div
    :class="`wrap wrap--narrow detail${paperHost ? ' ' + paperHost : ''}`"
    :data-testid="c ? 'capsule-detail' : null"
    :data-code="c ? c.code : null"
    :data-state="c ? (isOpenedView ? 'opened' : 'sealed') : null"
    :data-in-plaza="c ? (c.inPlaza ? 'true' : 'false') : null"
  >
    {{-- 加载失败 --}}
    <template x-if="status === 'error'">
      <div class="lost" role="alert">
        <p>暂时无法加载这枚胶囊，请稍后重试。</p>
        <button class="btn btn--ghost" type="button" @click="reload()">重试</button>
      </div>
    </template>

    {{-- 查无此信 --}}
    <template x-if="status === 'missing'">
      <div class="lost" data-testid="detail-not-found">
        <div class="lost__mark"><span class="seal seal--line" aria-hidden="true">无</span></div>
        <h1 class="h1">查无此信</h1>
        <p>
          <template x-if="code">
            <span>没有找到胶囊码为 <b class="mono" x-text="code.toUpperCase()"></b> 的胶囊。</span>
          </template>
          <template x-if="!code">
            <span>这枚胶囊不存在。</span>
          </template>
          <br>它也可能已经被作者删除了。
        </p>
        <div class="lost__act">
          <a class="btn btn--primary" href="/open">{!! UiHelper::icon('key') !!}重新输入胶囊码</a>
          <a class="btn btn--ghost" href="/">回到广场</a>
        </div>
      </div>
    </template>

    {{-- 已启封：信笺 --}}
    <template x-if="c && isOpenedView">
      <div style="display:contents">
        <a class="back" href="/">{!! UiHelper::icon('arrow-left') !!}返回广场</a>
        <article class="letter" :class="reveal ? 'letter--reveal' : ''">
          <div class="letter__pm" x-html="HT.postmarkSvg(HT.fmt.date(openAtMs), '已 启 封', 'pm--letter')"></div>
          <div class="letter__meta">
            <span class="mono" x-text="`NO. ${c.code}`"></span>
            <template x-if="c.inPlaza">
              <span class="tag">{!! UiHelper::icon('globe') !!}广场公开</span>
            </template>
            <template x-if="!c.inPlaza">
              <span class="tag tag--quiet">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
            </template>
          </div>
          <h1 class="letter__title" data-testid="detail-title" x-text="c.title"></h1>
          <dl class="letter__facts">
            <div><dt>封存</dt><dd class="mono" x-text="HT.fmt.dateTime(createdAtMs)"></dd></div>
            <div><dt>启封</dt><dd class="mono" x-text="HT.fmt.dateTime(openAtMs)"></dd></div>
            <div><dt>在途</dt><dd x-text="HT.fmt.span(openAtMs - createdAtMs)"></dd></div>
          </dl>
          <div class="letter__body" data-testid="detail-content">
            <template x-for="(para, pi) in HT.fmt.paragraphs(c.content)" :key="pi">
              <p :style="`--i:${pi}`" style="white-space:pre-line" x-text="para"></p>
            </template>
          </div>
          <footer class="letter__sign">
            <div class="letter__from">
              <span>——</span>
              <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
              <b x-text="c.creator.nickname"></b>
            </div>
            <div class="letter__date" x-text="`写于 ${HT.fmt.cn(createdAtMs)}`"></div>
            <span class="seal seal--line letter__seal" aria-hidden="true">启</span>
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
        </div>
        <template x-if="c.inPlaza">
          <p class="note note--ok">
            {!! UiHelper::icon('check') !!}
            <span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span>
          </p>
        </template>
        <template x-if="!c.inPlaza">
          <p class="note">
            {!! UiHelper::icon('lock') !!}
            <span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span>
          </p>
        </template>
      </div>
    </template>

    {{-- 未启封：信封 + 翻页倒计时 + 刻度尺 --}}
    <template x-if="c && !isOpenedView">
      <div style="display:contents">
        <a class="back" href="/">{!! UiHelper::icon('arrow-left') !!}返回广场</a>
        <header class="detail__head">
          <div class="detail__meta">
            <span class="mono" x-text="`NO. ${c.code}`"></span>
            <template x-if="c.inPlaza">
              <span class="tag">{!! UiHelper::icon('globe') !!}广场公开</span>
            </template>
            <template x-if="!c.inPlaza">
              <span class="tag tag--quiet">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
            </template>
            <span class="tag tag--seal">
              <span class="seal seal--solid" aria-hidden="true">封</span>未开启
            </span>
          </div>
          <h1 class="detail__title" data-testid="detail-title" x-text="c.title"></h1>
          <div class="detail__by">
            <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
            <b x-text="c.creator.nickname"></b>
            <span x-text="`封存于 ${HT.fmt.cn(createdAtMs)} ${HT.fmt.time(createdAtMs)}`"></span>
          </div>
        </header>

        <section class="stage">
          <div class="stage__pm" x-html="HT.postmarkSvg(HT.fmt.date(openAtMs), `${HT.fmt.time(openAtMs)} 启`, 'pm--stage')"></div>
          <div :class="`env env--stage${paperOpening?.open ? ' is-open' : ''}${paperOpening?.rising ? ' is-rising' : ''}`">
            <div class="env__back"></div>
            <div class="env__letter">
              <b x-text="c.title"></b><i></i><i></i><i></i><i></i>
            </div>
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
            <div class="env__seal" :class="paperOpening?.crack === 'cracked' ? 'is-cracked' : ''">
              <template x-if="!paperOpening || paperOpening.crack === 'whole'">
                <span style="display:contents" x-html="HT.waxHtml('封')"></span>
              </template>
              <template x-if="paperOpening && paperOpening.crack !== 'whole'">
                <div style="display:contents">
                  <span class="wax-half wax-half--l" x-html="HT.waxHtml('封')"></span>
                  <span class="wax-half wax-half--r" x-html="HT.waxHtml('封')"></span>
                </div>
              </template>
            </div>
          </div>
          <div class="stage__floor"></div>
        </section>

        <section
          class="cd"
          aria-live="off"
          role="timer"
          data-testid="countdown"
          :data-open-at="c.openAt"
          :aria-label="`距离启封还有 ${cd.d} 天 ${cd.h} 小时 ${cd.m} 分 ${cd.s} 秒`"
        >
          <div class="cd__label" x-text="paperOpening ? '时间到了，正在启封…' : '距离启封还有'"></div>
          <div class="cd__digits">
            <div class="cd__unit">
              <span class="cd__num latin">
                <template x-for="(ch, di) in Array.from(cdDaysStr())" :key="`d-${di}`">
                  <span class="dg" :data-v="ch"><span class="dg__cur" x-text="ch"></span></span>
                </template>
              </span>
              <span class="cd__lab">天</span>
            </div>
            <i class="cd__sep">:</i>
            <div class="cd__unit">
              <span class="cd__num latin">
                <template x-for="(ch, hi) in Array.from(HT.fmt.pad2(cd.h))" :key="`h-${hi}`">
                  <span class="dg" :data-v="ch"><span class="dg__cur" x-text="ch"></span></span>
                </template>
              </span>
              <span class="cd__lab">时</span>
            </div>
            <i class="cd__sep">:</i>
            <div class="cd__unit">
              <span class="cd__num latin">
                <template x-for="(ch, mi) in Array.from(HT.fmt.pad2(cd.m))" :key="`m-${mi}`">
                  <span class="dg" :data-v="ch"><span class="dg__cur" x-text="ch"></span></span>
                </template>
              </span>
              <span class="cd__lab">分</span>
            </div>
            <i class="cd__sep">:</i>
            <div class="cd__unit">
              <span class="cd__num latin">
                <template x-for="(ch, si) in Array.from(HT.fmt.pad2(cd.s))" :key="`s-${si}`">
                  <span class="dg" :data-v="ch"><span class="dg__cur" x-text="ch"></span></span>
                </template>
              </span>
              <span class="cd__lab">秒</span>
            </div>
          </div>
          <div class="cd__when">将于 <b x-text="HT.fmt.full(openAtMs)"></b> 启封</div>
        </section>

        <section class="journey">
          <div class="journey__row">
            <span><em>封存</em><span x-text="HT.fmt.date(createdAtMs)"></span></span>
            <span class="journey__pct" x-text="`已等待 ${HT.fmt.progress(createdAtMs, openAtMs, $store.clock.now)}%`"></span>
            <span><em>启封</em><span x-text="HT.fmt.date(openAtMs)"></span></span>
          </div>
          <div class="scale scale--lg" :style="`--p:${HT.fmt.progress(createdAtMs, openAtMs, $store.clock.now)}%`">
            <i class="scale__fill"></i>
            <i class="scale__mark"></i>
          </div>
        </section>

        <div class="detail__actions">
          @include('components.fav-button', ['capExpr' => 'c', 'size' => 'md'])
          <button class="btn btn--ghost" type="button" data-testid="copy-code" @click="copyCode()">
            {!! UiHelper::icon('copy') !!}复制胶囊码
          </button>
          <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="copyLink()">
            {!! UiHelper::icon('link') !!}分享链接
          </button>
        </div>
        <p class="note">
          {!! UiHelper::icon('info') !!}
          <span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span>
        </p>
      </div>
    </template>
  </div>
</div>
