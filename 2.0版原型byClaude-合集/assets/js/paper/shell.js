/* ============================================================
   皮肤「时笺」· 外壳模板：页头 · 页脚（技术栈题记）· 移动端底栏
   事件由共享外壳 app.js 统一处理，这里只出标记（id 两套皮肤一致）
   ============================================================ */
(function (HT) {
  'use strict';
  const { esc, icon } = HT;
  const S = HT.skin('paper');

  S.themeColor = { light: '#F3EFE5', dark: '#131210' };
  S.themeLabel = { light: '昼', dark: '夜' };

  function account(u) {
    if (!u) return `<a class="btn btn--text hdr__login" href="#/login">登录</a><a class="btn btn--primary btn--sm" href="#/register">注册</a>`;
    return `<div class="umenu" id="umenu">
        <button class="uchip" type="button" id="uchip" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(u.nickname)} 的菜单">
          ${HT.avatar(u.avatarId)}<span class="uchip__n">${esc(u.nickname)}</span>${icon('chev-down', 'ic--chev')}
        </button>
        <div class="umenu__pop" role="menu">
          <div class="umenu__who">${HT.avatar(u.avatarId, 'av--lg')}<div><b>${esc(u.nickname)}</b><span class="mono">${esc(u.email)}</span></div></div>
          <a role="menuitem" href="#/me/created">${icon('mail')}我创建的</a>
          <a role="menuitem" href="#/me/favorites">${icon('heart')}我收藏的</a>
          <a role="menuitem" href="#/me/profile">${icon('sliders')}账号设置</a>
          <hr>
          <button role="menuitem" type="button" data-hdr-logout>${icon('logout')}登出</button>
        </div>
      </div>`;
  }

  S.shell.header = ({ user, theme, skinSw }) => `
    <div class="wrap hdr__in">
      <a class="brand" href="#/" aria-label="HelloTime Pro 首页">${HT.logo()}<span class="brand__name latin">HelloTime</span><sup class="brand__pro mono">PRO</sup></a>
      <nav class="nav" aria-label="主导航">
        <a href="#/" data-nav="plaza">广场</a>
        <a href="#/open" data-nav="open">开启</a>
        <a href="#/about" data-nav="about">关于</a>
      </nav>
      <div class="hdr__act">
        <a class="btn btn--ghost btn--sm hdr__write" href="#/create" data-nav="create">${icon('pen')}写一枚</a>
        ${skinSw}
        <button class="iconbtn theme" type="button" id="themeBtn" aria-label="${theme === 'dark' ? '切换到日间主题' : '切换到夜间主题'}">${icon('sun', 'theme__sun')}${icon('moon', 'theme__moon')}</button>
        ${account(user)}
      </div>
    </div>`;

  S.shell.footer = () => {
    const h = HT.api.health();
    const li = (it) => `<li title="${HT.ROLE_LABEL[it.role] || it.role}">${HT.techIcon(it)}<span>${esc(it.name)}</span><small class="mono">${esc(it.version || '')}</small></li>`;
    return `
      <div class="wrap ftr__in">
        <div class="ftr__brand">
          <a class="brand" href="#/">${HT.logo()}<span class="brand__name latin">HelloTime</span><sup class="brand__pro mono">PRO</sup></a>
          <p class="ftr__motto serif">把此刻，寄给未来。</p>
          <p class="ftr__fine">一个多技术栈对比学习项目 · 不面向生产</p>
        </div>
        <div class="ftr__colo">
          <div class="ftr__k"><span>本页由以下技术栈排印</span><span class="ftr__live"><span class="dot dot--on"></span>后端在线 · ${esc(h.backend.name)}</span></div>
          <ul class="stack" id="stack">${h.frontend.map(li).join('')}<li class="stack__x" aria-hidden="true">×</li>${h.backend.items.map(li).join('')}</ul>
        </div>
      </div>
      <div class="wrap ftr__base">
        <span>© 2026 HelloTime Pro · MIT License</span>
        <nav aria-label="页脚"><a href="#/">广场</a><a href="#/open">开启</a><a href="#/about">关于</a><a href="#/design">设计规范</a></nav>
      </div>`;
  };

  S.shell.tabbar = ({ user }) => `
    <a href="#/" data-nav="plaza">${icon('grid')}<span>广场</span></a>
    <a href="#/open" data-nav="open">${icon('key')}<span>开启</span></a>
    <a href="#/create" data-nav="create" class="tabbar__main"><i>${icon('pen')}</i><span>写信</span></a>
    <a href="${user ? '#/me/created' : '#/login'}" data-nav="me">${user ? HT.avatar(user.avatarId) : icon('user')}<span>${user ? '我的' : '登录'}</span></a>`;
})(window.HT);
