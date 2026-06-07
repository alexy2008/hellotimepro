@props(['active'])

<aside class="cy-me__nav">
  <a href="/me/created" class="{{ $active === 'created' ? 'is-active' : '' }}">📝 我创建的</a>
  <a href="/me/favorites" class="{{ $active === 'favorites' ? 'is-active' : '' }}">♥ 我收藏的</a>
  <a href="/me/profile" class="{{ $active === 'profile' ? 'is-active' : '' }}">⚙ 账号设置</a>
</aside>
