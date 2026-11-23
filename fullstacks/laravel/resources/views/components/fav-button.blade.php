@php
  use App\Support\UiHelper;
  $capExpr = $capExpr ?? 'c';
  $size = $size ?? 'sm';
  $md = $size === 'md';
  $onChangeExpr = $onChangeExpr ?? 'null';
@endphp
<button
  x-data="favBtn(() => {{ $capExpr }}, {{ $onChangeExpr }})"
  :class="`fav fav--{{ $md ? 'md' : 'sm' }}${cap?.favoritedByMe ? ' is-on' : ''}${pop ? ' is-pop' : ''}`"
  type="button"
  :aria-pressed="cap?.favoritedByMe ? 'true' : 'false'"
  :aria-label="`${cap?.favoritedByMe ? '取消收藏' : '收藏'}，已有 ${cap?.favoriteCount ?? 0} 人收藏`"
  data-testid="fav-button"
  :data-count="cap?.favoriteCount ?? 0"
  @click="toggle($event)"
>
  <span class="fav__ic">
    {!! UiHelper::icon('heart') !!}
    <template x-if="burst && !HT.fmt.reducedMotion()">
      <span class="burst">
        @for ($bi = 0; $bi < 7; $bi++)
          <i style="--a:{{ round($bi * 51.4 - 90) }}deg;--d:{{ 15 + ($bi % 3) * 5 }}px"></i>
        @endfor
      </span>
    </template>
  </span>
  @if($md)
    <span class="fav__t" x-text="cap?.favoritedByMe ? '已收藏' : '收藏'"></span>
  @endif
  <span class="fav__n" x-text="HT.fmt.num(cap?.favoriteCount ?? 0)"></span>
</button>
