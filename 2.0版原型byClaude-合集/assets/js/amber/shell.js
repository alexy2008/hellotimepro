/* ============================================================
   皮肤「琥珀与夜空」· 外壳模板：悬浮胶囊顶栏 · 页脚 · 移动端底栏 · 背景
   事件由共享外壳 app.js 统一处理，这里只出标记（id 两套皮肤一致）
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, esc, icon } = HT;
  const S = HT.skin('amber');

  S.themeColor = { light: '#faf5ea', dark: '#080b1a' };
  S.themeLabel = { light: '晨曦', dark: '星夜' };

  const NAV = [['plaza', '#/', '胶囊广场'], ['create', '#/create', '写一枚'], ['open', '#/open', '开启胶囊'], ['about', '#/about', '关于']];

  function account(u) {
    if (!u) return `<a class="btn btn--ghost btn--sm hdr__login" href="#/login">登录</a><a class="btn btn--primary btn--sm" href="#/register">注册</a>`;
    return `<div class="umenu" id="umenu">
        <button class="uchip" type="button" id="uchip" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(u.nickname)} 的菜单">
          ${HT.avatar(u.avatarId)}<span class="uchip__n">${esc(u.nickname)}</span>${icon('chev-down', 'ic--chev')}
        </button>
        <div class="umenu__pop" role="menu">
          <div class="umenu__who">${HT.avatar(u.avatarId, 'av--lg')}<div><b>${esc(u.nickname)}</b><span class="mono">${esc(u.email)}</span></div></div>
          <a role="menuitem" href="#/me/created">${icon('feather')}我创建的</a>
          <a role="menuitem" href="#/me/favorites">${icon('heart')}我收藏的</a>
          <a role="menuitem" href="#/me/profile">${icon('sliders')}账号设置</a>
          <hr>
          <button role="menuitem" type="button" data-hdr-logout>${icon('logout')}登出</button>
        </div>
      </div>`;
  }

  S.shell.header = ({ user, theme, skinSw }) => `
    <div class="hdr__bar">
      <a class="brand" href="#/" aria-label="HelloTime Pro 首页">${HT.logo(34, 'brand__logo')}<span class="brand__name">HelloTime<small>PRO</small></span></a>
      <nav class="nav" id="nav" aria-label="主导航">
        <span class="nav__ink" aria-hidden="true"></span>
        ${NAV.map(([k, h, l]) => `<a class="nav__link" href="${h}" data-nav="${k}">${l}</a>`).join('')}
      </nav>
      <div class="hdr__tools">
        ${skinSw}
        <button class="theme-toggle" type="button" id="themeBtn" role="switch" aria-checked="${theme === 'light'}"
          aria-label="${theme === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦'}">
          <span class="theme-toggle__stars"></span><span class="theme-toggle__cloud"></span><span class="theme-toggle__knob"></span>
        </button>
        ${account(user)}
      </div>
    </div>`;

  S.shell.footer = () => {
    const h = HT.api.health();
    const chip = (it) => `<span class="ftr__tech" title="${HT.ROLE_LABEL[it.role] || it.role} · ${esc(it.name)} ${esc(it.version || '')}">${HT.techIcon(it)}${esc(it.name)}</span>`;
    return `
      <div class="ftr__in">
        <a class="ftr__brand" href="#/">${HT.logo(22)}HelloTime Pro · 时间胶囊</a>
        <div class="ftr__stack" id="stack">
          <span class="ftr__dot" title="后端在线"></span>
          ${h.frontend.map(chip).join('')}<i class="ftr__x">×</i>${h.backend.items.map(chip).join('')}
        </div>
        <div class="ftr__meta"><a href="#/design">设计规范</a><span>把此刻，寄给未来</span><span class="mono">v2.0</span></div>
      </div>`;
  };

  S.shell.tabbar = ({ user }) => `
    <a href="#/" data-nav="plaza">${icon('grid')}<span>广场</span></a>
    <a href="#/open" data-nav="open">${icon('key')}<span>开启</span></a>
    <a href="#/create" data-nav="create" class="tabbar__main"><i>${icon('pen')}</i><span>写一枚</span></a>
    <a href="${user ? '#/me/created' : '#/login'}" data-nav="me">${user ? HT.avatar(user.avatarId) : icon('user')}<span>${user ? '我的' : '登录'}</span></a>`;

  /* 进出这套皮肤时：背景层的显隐与粒子动画的启停 */
  S.enter = () => { if (HT.sky) HT.sky.start(); };
  S.leave = () => { if (HT.sky) HT.sky.stop(); };
})(window.HT);
