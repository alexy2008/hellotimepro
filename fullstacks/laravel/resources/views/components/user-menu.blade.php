@php
  use App\Support\UiHelper;
  $createdIcon = $createdIcon ?? 'mail';
@endphp
<div class="umenu" :class="open ? 'is-open' : ''" x-data="userMenu()" @click.outside="close()" @keydown.escape.window="close()">
  <button
    class="uchip"
    type="button"
    aria-haspopup="menu"
    :aria-expanded="open ? 'true' : 'false'"
    :aria-label="($store.auth.user?.nickname || '') + ' 的菜单'"
    data-testid="user-menu"
    :data-nickname="$store.auth.user?.nickname || ''"
    @click="toggle()"
  >
    <span style="display:contents" x-html="HT.avatarHtml($store.auth.user?.avatarId)"></span>
    <span class="uchip__n" x-text="$store.auth.user?.nickname || ''"></span>
    {!! UiHelper::icon('chev-down', 'ic--chev') !!}
  </button>
  <div class="umenu__pop" role="menu">
    <div class="umenu__who">
      <span style="display:contents" x-html="HT.avatarHtml($store.auth.user?.avatarId, 'av--lg')"></span>
      <div>
        <b x-text="$store.auth.user?.nickname || ''"></b>
        <span class="mono" x-text="$store.auth.user?.email || ''"></span>
      </div>
    </div>
    <a role="menuitem" href="/me/created" data-testid="menu-created">
      {!! UiHelper::icon($createdIcon) !!}
      我创建的
    </a>
    <a role="menuitem" href="/me/favorites" data-testid="menu-favorites">
      {!! UiHelper::icon('heart') !!}
      我收藏的
    </a>
    <a role="menuitem" href="/me/profile" data-testid="menu-profile">
      {!! UiHelper::icon('sliders') !!}
      账号设置
    </a>
    <hr>
    <button role="menuitem" type="button" data-testid="logout" @click="doLogout()">
      {!! UiHelper::icon('logout') !!}
      登出
    </button>
  </div>
</div>
