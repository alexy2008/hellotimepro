@props(['active'])

<aside class="cy-me__nav">
  <a href="/me/created" class="{{ $active === 'created' ? 'is-active' : '' }}">📝 我创建的</a>
  <a href="/me/favorites" class="{{ $active === 'favorites' ? 'is-active' : '' }}">♥ 我收藏的</a>
  <a href="/me/profile" class="{{ $active === 'profile' ? 'is-active' : '' }}">⚙ 账号设置</a>
  <span style="border-top:1px solid var(--color-border-subtle);margin:var(--space-3) 0"></span>
  <form method="post" action="/logout" style="margin:0">
    @csrf
    <button type="submit"
            style="background:none;border:0;color:var(--color-danger-fg);cursor:pointer;font:inherit;font-size:var(--font-size-sm);padding:var(--space-3);text-align:left;width:100%">
      登出
    </button>
  </form>
</aside>
