@php
  use App\Support\UiHelper;
  $nk = $navKey ?? '';
@endphp
<nav class="tabbar" aria-label="主导航">
  <a href="/" data-testid="tab-plaza" class="{{ $nk === 'plaza' ? 'is-active' : '' }}" @if($nk === 'plaza') aria-current="page" @endif>
    {!! UiHelper::icon('grid') !!}
    <span>广场</span>
  </a>
  <a href="/open" data-testid="tab-open" class="{{ $nk === 'open' ? 'is-active' : '' }}" @if($nk === 'open') aria-current="page" @endif>
    {!! UiHelper::icon('key') !!}
    <span>开启</span>
  </a>
  <a href="/create" data-testid="tab-create" class="tabbar__main {{ $nk === 'create' ? 'is-active' : '' }}" @if($nk === 'create') aria-current="page" @endif @click="$store.feedback.goCreate($event)">
    <i>{!! UiHelper::icon('pen') !!}</i>
    <span>写一枚</span>
  </a>
  <a :href="$store.auth.user ? '/me/created' : '/login'" data-testid="tab-me" class="{{ $nk === 'me' ? 'is-active' : '' }}" @if($nk === 'me') aria-current="page" @endif>
    <template x-if="$store.auth.user">
      <span style="display:contents" x-html="HT.avatarHtml($store.auth.user.avatarId)"></span>
    </template>
    <template x-if="!$store.auth.user">
      <span style="display:contents">{!! UiHelper::icon('user') !!}</span>
    </template>
    <span x-text="$store.auth.user ? '我的' : '登录'"></span>
  </a>
</nav>
