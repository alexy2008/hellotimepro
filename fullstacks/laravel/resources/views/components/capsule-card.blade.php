@props(['capsule', 'showCreator' => true, 'hideFavorite' => false])
@php $opened = $capsule['isOpened']; @endphp

<article id="capsule-{{ $capsule['id'] }}" class="cy-capsule {{ $opened ? 'cy-capsule--opened' : 'cy-capsule--sealed' }}">
  <div class="cy-capsule__head">
    <span class="cy-badge {{ $opened ? 'cy-badge--opened' : 'cy-badge--sealed' }}">{{ $opened ? '已开启' : '未开启' }}</span>
    <a href="/c/{{ $capsule['code'] }}" class="cy-capsule__code" style="text-decoration:none">{{ $capsule['code'] }}</a>
  </div>

  <a href="/c/{{ $capsule['code'] }}" style="text-decoration:none;color:inherit">
    <h3 class="cy-capsule__title">{{ $capsule['title'] }}</h3>
  </a>

  @if(!$opened)
    <p class="cy-capsule__countdown" data-open-at="{{ $capsule['openAt'] }}" data-compact="1">⏳ {{ $fmt->countdownText($capsule['openAt']) }}</p>
  @elseif(!empty($capsule['contentPreview']))
    <p class="cy-capsule__preview">{{ $capsule['contentPreview'] }}</p>
  @endif

  <div class="cy-capsule__meta">
    @if($showCreator)
      <span class="cy-capsule__creator">
        <img src="/static/avatars/{{ $capsule['creator']['avatarId'] }}.svg" alt="">
        <span>{{ $capsule['creator']['nickname'] }}</span>
      </span>
    @else
      <span style="color:var(--color-text-muted)">创建于 {{ $fmt->formatDate($capsule['createdAt']) }}</span>
    @endif

    @if($hideFavorite)
      @if($opened)
        <span style="color:var(--color-favorite-active)">♥ {{ $capsule['favoriteCount'] }}</span>
      @else
        <form method="post" action="/me/capsules/{{ $capsule['id'] }}/delete" style="margin:0"
              onsubmit="return confirm('确认撤回？此操作不可恢复。')">
          @csrf
          <button type="submit" class="cy-btn cy-btn--ghost cy-btn--sm"
                  style="min-height:28px;padding:4px 12px;color:var(--color-danger-fg)">撤回</button>
        </form>
      @endif
    @else
      <button type="button" class="cy-capsule__fav {{ $capsule['favoritedByMe'] ? 'is-active' : '' }}"
              aria-label="收藏" data-capsule-id="{{ $capsule['id'] }}" @if($currentUser) data-authenticated="1" @endif>
        <span class="cy-fav-icon">{{ $capsule['favoritedByMe'] ? '♥' : '♡' }}</span>
        <span class="cy-fav-count" data-fav-count>{{ $capsule['favoriteCount'] }}</span>
      </button>
    @endif
  </div>
</article>
