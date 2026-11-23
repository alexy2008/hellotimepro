@php
  use App\Support\UiHelper;
  $cardTestId = $cardTestId ?? 'capsule-card';
  $openTestId = $openTestId ?? 'card-open';
  $withRank = $withRank ?? true;
  $favCallback = $favCallback ?? '(id, f, cnt) => patchFavorited(id, f, cnt)';
@endphp
<article
  :class="`pc ${isOpened(c) ? 'is-opened' : 'is-locked'}${typeof isFlipping === 'function' && isFlipping(c) ? ' is-flipping' : ''}`"
  :style="`--glow:${HT.paletteOf(c.code).glow};--i:${idx}`"
  data-testid="{{ $cardTestId }}"
  :data-code="c.code"
  :data-state="isOpened(c) ? 'opened' : 'sealed'"
  :data-in-plaza="c.inPlaza ? 'true' : 'false'"
>
  <a
    class="pc__link"
    :href="`/capsules/${c.code}`"
    :aria-label="`${c.title}，${isOpened(c) ? '已开启' : '封存中'}`"
    data-testid="{{ $openTestId }}"
  ></a>

  <div class="pc__top">
    <div class="pc__art" x-html="HT.capsuleArtSvg(c.code, isOpened(c) ? 'opened' : 'locked', 150)"></div>
    <div class="pc__badges">
      <template x-if="isOpened(c)">
        <span class="badge badge--opened">{!! UiHelper::icon('mail') !!}已开启</span>
      </template>
      <template x-if="!isOpened(c)">
        <span class="badge badge--locked">{!! UiHelper::icon('lock') !!}封存中</span>
      </template>
      @if($withRank)
        <template x-if="rankOf(idx)">
          <span class="badge badge--hot">{!! UiHelper::icon('fire') !!}<span x-text="`热度 No.${rankOf(idx)}`"></span></span>
        </template>
      @endif
      <template x-if="!c.inPlaza">
        <span class="badge badge--private">{!! UiHelper::icon('lock') !!}未公开</span>
      </template>
    </div>
  </div>

  <h3 class="pc__title" data-testid="card-title" x-text="c.title"></h3>

  <div class="pc__by">
    <span style="display:contents" x-html="HT.avatarHtml(c.creator.avatarId)"></span>
    <span class="pc__name" x-text="c.creator.nickname"></span>
    <template x-if="isMine(c.creator.nickname)">
      <em class="me-tag">我</em>
    </template>
    <i></i>
    <span x-text="`封存于 ${HT.fmt.date(HT.fmt.ms(c.createdAt))}`"></span>
  </div>

  <div class="pc__body">
    <template x-if="isOpened(c)">
      <p class="pc__excerpt" x-text="HT.fmt.preview(c.contentPreview, 80)"></p>
    </template>
    <template x-if="!isOpened(c)">
      <div style="display:contents">
        <div class="pc__cd">
          {!! UiHelper::icon('hourglass') !!}
          <span class="pc__time mono" x-text="HT.fmt.cdAmber(HT.fmt.ms(c.openAt), $store.clock.now)"></span>后开启
        </div>
        <div class="pc__progress" title="从封存到开启，时间已经走过的比例">
          <span :style="`width:${Math.max(2, HT.fmt.progress(HT.fmt.ms(c.createdAt), HT.fmt.ms(c.openAt), $store.clock.now))}%`"></span>
        </div>
      </div>
    </template>
  </div>

  <div class="pc__foot">
    <span class="pc__when">
      {!! UiHelper::icon('calendar') !!}
      <span x-text="`${HT.fmt.dateTime(HT.fmt.ms(c.openAt))} ${isOpened(c) ? '已开启' : '开启'}`"></span>
    </span>
    @include('components.fav-button', ['capExpr' => 'c', 'size' => 'sm', 'onChangeExpr' => $favCallback])
  </div>
</article>
