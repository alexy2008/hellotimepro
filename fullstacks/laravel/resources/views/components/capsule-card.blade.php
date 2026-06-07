@props(['capsule', 'showCreator' => true, 'hideFavorite' => false])

<article class="cy-capsule {{ $capsule['isOpened'] ? 'cy-capsule--opened' : 'cy-capsule--sealed' }}">
  <div class="cy-capsule__head">
    <div>
      <h3 class="cy-capsule__title"><a href="/c/{{ $capsule['code'] }}">{{ $capsule['title'] }}</a></h3>
      @if($showCreator)
        <div class="cy-capsule__creator">
          <img src="/static/avatars/{{ $capsule['creator']['avatarId'] }}.svg" alt="">
          <span>{{ $capsule['creator']['nickname'] }}</span>
        </div>
      @endif
    </div>
    @unless($hideFavorite)
      <button type="button"
        class="cy-capsule__fav {{ $capsule['favoritedByMe'] ? 'is-active' : '' }}"
        aria-label="收藏"
        data-capsule-id="{{ $capsule['id'] }}"
        @if($currentUser) data-authenticated="1" @endif>
        ♥ <span data-fav-count>{{ $capsule['favoriteCount'] }}</span>
      </button>
    @endunless
  </div>
  <div class="cy-capsule__meta">
    <span>{{ $capsule['isOpened'] ? '已开启' : '未开启' }}</span>
    <span>{{ $hello->formatDate($capsule['openAt']) }}</span>
    @if(!$capsule['inPlaza'])<span>私密</span>@endif
  </div>
  @if($capsule['isOpened'] && !empty($capsule['contentPreview']))
    <p class="cy-capsule__preview">{{ $capsule['contentPreview'] }}</p>
  @else
    <p class="cy-capsule__preview" data-open-at="{{ $capsule['openAt'] }}" data-compact="1">⏳ {{ $hello->countdownText($capsule['openAt']) }}</p>
  @endif
</article>
