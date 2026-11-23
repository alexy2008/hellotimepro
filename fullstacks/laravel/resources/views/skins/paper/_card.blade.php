@php
  use App\Support\UiHelper;
  $cardTestId = $cardTestId ?? 'capsule-card';
  $openTestId = $openTestId ?? 'card-open';
  $withRank = $withRank ?? true;
  $favCallback = $favCallback ?? '(id, f, cnt) => patchFavorited(id, f, cnt)';
@endphp
<article
  :class="`cap cap--${isOpened(c) ? 'opened' : 'sealed'}`"
  :style="`--i:${idx}`"
  data-testid="{{ $cardTestId }}"
  :data-code="c.code"
  :data-state="isOpened(c) ? 'opened' : 'sealed'"
  :data-in-plaza="c.inPlaza ? 'true' : 'false'"
>
  <div class="cap__bg" aria-hidden="true">
    <template x-if="isOpened(c)">
      <svg class="cap__art" viewBox="0 0 120 100" aria-hidden="true">
        <path class="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/>
        <rect class="ea__paper" x="16" y="14" width="88" height="62" rx="1.5"/>
        <path class="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44"/>
        <path class="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/>
        <path class="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70"/>
      </svg>
    </template>
    <template x-if="!isOpened(c)">
      <svg class="cap__art" viewBox="0 0 120 84" aria-hidden="true">
        <rect class="ea__body" x="2" y="6" width="116" height="76" rx="3"/>
        <path class="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46"/>
        <path class="ea__flap" d="M3 7.5 60 48 117 7.5"/>
        <g class="ea__seal">
          <circle cx="60" cy="48" r="11"/>
          <circle class="ea__seal-ring" cx="60" cy="48" r="7"/>
        </g>
      </svg>
    </template>
  </div>

  <a
    class="cap__link"
    :href="`/capsules/${c.code}`"
    :aria-label="`${c.title}，${isOpened(c) ? '已开启' : '未开启'}`"
    data-testid="{{ $openTestId }}"
  ></a>

  <header class="cap__top">
    <span :class="`seal seal--${isOpened(c) ? 'line' : 'solid'}`" aria-hidden="true" x-text="isOpened(c) ? '启' : '封'"></span>
    <span class="cap__status" x-text="isOpened(c) ? '已开启' : '未开启'"></span>
    <template x-if="!c.inPlaza">
      <span class="cap__private" title="没有发布到广场，凭胶囊码可见">
        {!! UiHelper::icon('lock') !!}
        未公开
      </span>
    </template>
    @if($withRank)
      <template x-if="rankOf(idx)">
        <span class="cap__rank latin" :title="`热度第 ${rankOf(idx)}`" x-text="`No.${rankOf(idx)}`"></span>
      </template>
    @endif
    <span class="cap__code mono" x-text="c.code"></span>
  </header>

  <h3 class="cap__title" data-testid="card-title" x-text="c.title"></h3>

  <template x-if="isOpened(c)">
    <div style="display:contents">
      <p class="cap__preview" x-text="HT.fmt.preview(c.contentPreview, 78)"></p>
      <div class="cap__when">
        <span x-text="`启于 ${HT.fmt.date(HT.fmt.ms(c.openAt))}`"></span>
        <i></i>
        <span x-text="`在途 ${HT.fmt.span(HT.fmt.ms(c.openAt) - HT.fmt.ms(c.createdAt))}`"></span>
      </div>
    </div>
  </template>

  <template x-if="!isOpened(c)">
    <div style="display:contents">
      <div class="cap__veil" aria-hidden="true"><i></i><i></i></div>
      <div class="cap__cd">
        <span class="cap__cd-label">距启封</span>
        <span class="cap__cd-val">
          <template x-if="HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d > 0">
            <span style="display:contents">
              <b class="latin" x-text="HT.fmt.num(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d)"></b>
              <small>天</small>
              <span class="mono" x-text="`${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).h)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).m)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).s)}`"></span>
            </span>
          </template>
          <template x-if="HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d === 0">
            <b class="mono cap__cd-hms" x-text="`${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).h)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).m)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).s)}`"></b>
          </template>
        </span>
      </div>
      <div class="scale" :style="`--p:${HT.fmt.progress(HT.fmt.ms(c.createdAt), HT.fmt.ms(c.openAt), $store.clock.now)}%`">
        <i class="scale__fill"></i>
        <i class="scale__mark"></i>
      </div>
      <div class="cap__ends mono">
        <span x-text="HT.fmt.date(HT.fmt.ms(c.createdAt))"></span>
        <span x-text="HT.fmt.date(HT.fmt.ms(c.openAt))"></span>
      </div>
    </div>
  </template>

  <footer class="cap__foot">
    <span class="who">
      <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
      <span class="who__n" x-text="c.creator.nickname"></span>
      <template x-if="isMine(c.creator.nickname)">
        <em class="who__me">我</em>
      </template>
    </span>
    @include('components.fav-button', ['capExpr' => 'c', 'size' => 'sm', 'onChangeExpr' => $favCallback])
  </footer>
</article>
