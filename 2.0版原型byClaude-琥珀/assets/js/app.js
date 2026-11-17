/* ============================================================
   应用外壳：悬浮胶囊顶栏 · 页脚 · 移动端底栏 · 路由 · 主题 · 原型导览
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;
  const viewEl = $('#view');

  /* ---------------- 主题：星夜 / 晨曦 ---------------- */
  const theme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  function setTheme(next, origin) {
    const apply = () => {
      document.documentElement.dataset.theme = next;
      HT.LS.set('theme', next);
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#080b1a' : '#faf5ea';
      const btn = $('#themeBtn');
      if (btn) {
        btn.setAttribute('aria-checked', String(next === 'light'));
        btn.setAttribute('aria-label', next === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦');
      }
      HT.bus.emit('theme', next);
    };
    if (!document.startViewTransition || HT.reduced()) return apply();
    /* 从点击处圆形晕开 */
    const x = origin ? origin.x : innerWidth - 60, y = origin ? origin.y : 40;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('is-theming');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 620, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    vt.finished.finally(() => document.documentElement.classList.remove('is-theming'));
  }

  /* ---------------- 顶栏 ---------------- */
  const NAV = [['plaza', '#/', '胶囊广场'], ['create', '#/create', '写一枚'], ['open', '#/open', '开启胶囊'], ['about', '#/about', '关于']];

  function renderHeader() {
    const u = HT.state.user;
    const account = u ? `
      <div class="umenu" id="umenu">
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
      </div>` : `
      <a class="btn btn--ghost btn--sm hdr__login" href="#/login">登录</a>
      <a class="btn btn--primary btn--sm" href="#/register">注册</a>`;
    $('#header').innerHTML = `
      <div class="hdr__bar">
        <a class="brand" href="#/" aria-label="HelloTime Pro 首页">${HT.logo(34, 'brand__logo')}<span class="brand__name">HelloTime<small>PRO</small></span></a>
        <nav class="nav" id="nav" aria-label="主导航">
          <span class="nav__ink" aria-hidden="true"></span>
          ${NAV.map(([k, h, l]) => `<a class="nav__link" href="${h}" data-nav="${k}">${l}</a>`).join('')}
        </nav>
        <div class="hdr__tools">
          <button class="theme-toggle" type="button" id="themeBtn" role="switch" aria-checked="${theme() === 'light'}"
            aria-label="${theme() === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦'}">
            <span class="theme-toggle__stars"></span><span class="theme-toggle__cloud"></span><span class="theme-toggle__knob"></span>
          </button>
          ${account}
        </div>
      </div>`;
    markNav(false);
  }

  /* 导航高亮底：跟着当前页滑过去 */
  function placeInk(animate) {
    const nav = $('#nav');
    if (!nav) return;
    const ink = $('.nav__ink', nav), a = $('.nav__link.is-active', nav);
    if (!a) { ink.style.opacity = 0; return; }
    if (!animate) ink.style.transition = 'none';
    ink.style.opacity = 1;
    ink.style.width = a.offsetWidth + 'px';
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    if (!animate) { void ink.offsetWidth; ink.style.transition = ''; }
  }

  /* ---------------- 页脚：本页的技术栈 ---------------- */
  function renderFooter() {
    const h = HT.api.health();
    const chip = (it) => `<span class="ftr__tech" title="${HT.ROLE_LABEL[it.role] || it.role} · ${esc(it.name)} ${esc(it.version || '')}">${HT.techIcon(it)}${esc(it.name)}</span>`;
    $('#footer').innerHTML = `
      <div class="ftr__in">
        <a class="ftr__brand" href="#/">${HT.logo(22)}HelloTime Pro · 时间胶囊</a>
        <div class="ftr__stack" id="stack">
          <span class="ftr__dot" title="后端在线"></span>
          ${h.frontend.map(chip).join('')}<i class="ftr__x">×</i>${h.backend.items.map(chip).join('')}
        </div>
        <div class="ftr__meta"><a href="#/design">设计规范</a><span>把此刻，寄给未来</span><span class="mono">v2.0</span></div>
      </div>`;
  }

  /* ---------------- 移动端底栏 ---------------- */
  function renderTabbar() {
    const u = HT.state.user;
    $('#tabbar').innerHTML = `
      <a href="#/" data-nav="plaza">${icon('grid')}<span>广场</span></a>
      <a href="#/open" data-nav="open">${icon('key')}<span>开启</span></a>
      <a href="#/create" data-nav="create" class="tabbar__main"><i>${icon('pen')}</i><span>写一枚</span></a>
      <a href="${u ? '#/me/created' : '#/login'}" data-nav="me">${u ? HT.avatar(u.avatarId) : icon('user')}<span>${u ? '我的' : '登录'}</span></a>`;
    markNav(false);
  }

  function markNav(animate) {
    const nav = HT.route ? HT.route.nav : null;
    $$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    placeInk(animate);
  }

  /* ---------------- 路由 ---------------- */
  const ROUTES = [
    { re: /^\/$/, view: 'plaza', nav: 'plaza' },
    { re: /^\/create$/, view: 'create', nav: 'create' },
    { re: /^\/open$/, view: 'open', nav: 'open' },
    { re: /^\/(?:c|capsules)\/([A-Za-z0-9]{1,16})$/, view: 'capsule', keys: ['code'], nav: 'open' },
    { re: /^\/plaza\/([\w-]+)$/, view: 'capsule', keys: ['id'], nav: 'plaza' },
    { re: /^\/login$/, view: 'login', nav: 'me' },
    { re: /^\/register$/, view: 'register', nav: 'me' },
    { re: /^\/me(?:\/(created|favorites|profile))?$/, view: 'me', keys: ['tab'], nav: 'me' },
    { re: /^\/about$/, view: 'about', nav: 'about' },
    { re: /^\/design$/, view: 'design' },
  ];

  let cur = null;
  let plazaScroll = 0;

  function parse() {
    const raw = (location.hash || '#/').slice(1) || '/';
    const i = raw.indexOf('?');
    const path = (i < 0 ? raw : raw.slice(0, i)) || '/';
    const query = {};
    if (i >= 0) new URLSearchParams(raw.slice(i + 1)).forEach((v, k) => { query[k] = v; });
    return { path, query };
  }
  const replace = (path) => location.replace('#' + path);

  function route(force) {
    const { path, query } = parse();
    let def = null, m = null;
    for (const r of ROUTES) { m = r.re.exec(path); if (m) { def = r; break; } }
    const params = {};
    if (def && def.keys) def.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    const name = def ? def.view : 'notfound';
    const view = HT.views[name];
    const ctx = { path, query, params };

    if (view.auth && !HT.state.user) { HT.toast('请先登录', { type: 'info' }); return replace('/login?redirect=' + encodeURIComponent(path)); }
    if (view.guest && HT.state.user) return replace(query.redirect || '/');
    if (name === 'me' && !params.tab) return replace('/me/created');

    const prev = cur ? cur.name : null;
    if (prev === 'plaza' && name !== 'plaza') plazaScroll = window.scrollY;
    HT.route = { path, name, nav: def ? def.nav : null };
    closeMenu();

    if (!force && cur && cur.name === name && view.update && cur.page.isConnected) {
      view.update(cur.page, ctx);
      markNav(true);
      return;
    }

    if (cur && cur.cleanup) { try { cur.cleanup(); } catch (e) { console.error(e); } }
    HT.tick.clear();
    $$('.dlg').forEach((d) => d.remove());

    document.title = (view.title ? view.title + ' · ' : '') + 'HelloTime Pro';
    document.body.dataset.route = name;
    viewEl.innerHTML = view.render(ctx);
    const page = viewEl.firstElementChild;
    const cleanup = view.mount ? view.mount(page, ctx) : null;
    cur = { name, page, cleanup: typeof cleanup === 'function' ? cleanup : null };

    const back = name === 'plaza' && prev === 'capsule' && plazaScroll > 0;
    window.scrollTo(0, back ? plazaScroll : 0);
    markNav(true);
  }
  HT.refresh = () => route(true);

  function closeMenu() {
    const m = $('#umenu');
    if (m) { m.classList.remove('is-open'); const c = $('#uchip'); if (c) c.setAttribute('aria-expanded', 'false'); }
  }

  document.addEventListener('click', (e) => {
    const tb = e.target.closest('#themeBtn');
    if (tb) {
      const r = tb.getBoundingClientRect();
      const kb = e.clientX === 0 && e.clientY === 0;
      return setTheme(theme() === 'dark' ? 'light' : 'dark', { x: kb ? r.left + r.width / 2 : e.clientX, y: kb ? r.top + r.height / 2 : e.clientY });
    }

    const chip = e.target.closest('#uchip');
    if (chip) { const m = $('#umenu'); const open = !m.classList.contains('is-open'); m.classList.toggle('is-open', open); chip.setAttribute('aria-expanded', String(open)); return; }
    if (e.target.closest('[data-hdr-logout]')) { HT.api.logout(); HT.toast('已登出'); if (location.hash === '#/' || location.hash === '') route(true); else HT.go('/'); return; }
    if (!e.target.closest('#umenu')) closeMenu();

    /* 收藏：全站统一处理 */
    const fb = e.target.closest('[data-fav]');
    if (fb) {
      e.preventDefault();
      const id = fb.dataset.fav;
      if (!HT.state.user) return HT.askLogin('登录后才能收藏');
      const c = HT.api.byId(id, true);
      if (!c) return;
      if (c.mine) { HT.shake(fb); return HT.toast('不能收藏自己写的胶囊', { type: 'info' }); }
      const r = HT.api.toggleFav(id);
      $$(`[data-fav="${id}"]`).forEach((b) => {
        b.classList.toggle('is-on', r.favorited);
        b.setAttribute('aria-pressed', String(r.favorited));
        $('.fav__n', b).textContent = fmt.num(r.favoriteCount);
        const t = $('.fav__t', b);
        if (t) t.textContent = r.favorited ? '已收藏' : '收藏';
      });
      if (r.favorited) { fb.classList.remove('is-pop'); void fb.offsetWidth; fb.classList.add('is-pop'); HT.burst($('.fav__ic', fb)); }
      HT.bus.emit('fav', Object.assign({ id }, r));
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); closeGuide(); } });

  const hdr = $('#header');
  const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => placeInk(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInk(false));

  /* ---------------- 原型导览（不属于产品，方便评审跳页与切状态） ---------------- */
  const guideEl = $('#guide');
  function renderGuide() {
    const link = (href, label, extra) => `<a href="${href}"${extra || ''}>${label}</a>`;
    guideEl.innerHTML = `
      <button class="guide__fab" type="button" id="guideFab" aria-expanded="false" aria-controls="guidePanel">${icon('compass')}<span>原型导览</span></button>
      <div class="guide__panel" id="guidePanel" role="dialog" aria-label="原型导览">
        <header class="guide__head"><div><b>原型导览</b><span>HelloTime Pro 2.0 ·「琥珀与夜空」</span></div><button class="icon-btn" type="button" data-guide-x aria-label="关闭">${icon('x')}</button></header>
        <section class="guide__sec">
          <h4>页面直达</h4>
          <div class="guide__links">
            ${link('#/', '首页 · 胶囊广场')}${link('#/create', '写一枚胶囊', ' data-need="auth"')}${link('#/open', '开启胶囊')}
            ${link('#/c/SAMESONG', '详情 · 封存中', ' data-g-sealed')}${link('#/c/GK25WIND', '详情 · 已开启')}${link('#/c/NOSUCH00', '详情 · 查无此码')}
            ${link('#/login', '登录', ' data-need="guest"')}${link('#/register', '注册', ' data-need="guest"')}
            ${link('#/me/created', '我创建的', ' data-need="auth"')}${link('#/me/favorites', '我收藏的', ' data-need="auth"')}${link('#/me/profile', '账号设置', ' data-need="auth"')}
            ${link('#/about', '关于')}${link('#/design', '设计规范')}${link('#/nowhere', '404')}
          </div>
        </section>
        <section class="guide__sec">
          <h4>演示状态</h4>
          <div class="guide__row"><span>身份</span><div class="gseg" data-g="auth"><button type="button" data-v="guest">游客</button><button type="button" data-v="demo">已登录</button></div></div>
          <div class="guide__row"><span>主题</span><div class="gseg" data-g="theme"><button type="button" data-v="dark">星夜</button><button type="button" data-v="light">晨曦</button></div></div>
          <div class="guide__row"><span>广场</span><div class="gseg" data-g="plaza"><button type="button" data-v="normal">正常</button><button type="button" data-v="loading">加载</button><button type="button" data-v="empty">空</button><button type="button" data-v="error">出错</button></div></div>
          <div class="guide__row"><span>后端</span><div class="select select--sm"><select data-g="backend" aria-label="模拟 :9080 指向的后端">${HT.BACKENDS.map((b) => `<option value="${b.key}">${b.name} · :${b.port}</option>`).join('')}</select>${icon('chev-down', 'select__arrow')}</div></div>
        </section>
        <footer class="guide__foot"><button class="link-btn" type="button" data-g-reset>${icon('refresh')}重置原型数据</button><span>数据只存在本机浏览器</span></footer>
      </div>`;
    syncGuide();
  }
  function syncGuide() {
    const set = (g, v) => $$(`[data-g="${g}"] button`, guideEl).forEach((b) => b.classList.toggle('is-active', b.dataset.v === v));
    set('auth', HT.state.user ? 'demo' : 'guest');
    set('theme', theme());
    set('plaza', HT.state.demo.plaza);
    const sel = $('select[data-g="backend"]', guideEl);
    if (sel) sel.value = HT.state.backend;
    const hot = HT.api.featured();
    const sealed = $('[data-g-sealed]', guideEl);
    if (sealed && hot) sealed.setAttribute('href', '#/c/' + hot.code);
  }
  function closeGuide() { guideEl.classList.remove('is-open'); const f = $('#guideFab'); if (f) f.setAttribute('aria-expanded', 'false'); }

  guideEl.addEventListener('click', (e) => {
    if (e.target.closest('#guideFab')) { const open = !guideEl.classList.contains('is-open'); guideEl.classList.toggle('is-open', open); $('#guideFab').setAttribute('aria-expanded', String(open)); if (open) syncGuide(); return; }
    if (e.target.closest('[data-guide-x]')) return closeGuide();
    if (e.target.closest('[data-g-reset]')) return HT.api.resetAll();

    const a = e.target.closest('.guide__links a');
    if (a) {
      if (a.dataset.need === 'auth' && !HT.state.user) HT.api.loginDemo();
      if (a.dataset.need === 'guest' && HT.state.user) HT.api.logout();
      if (a.getAttribute('href') === location.hash) { e.preventDefault(); route(true); }
      if (window.innerWidth < 720) closeGuide();
      return;
    }

    const b = e.target.closest('.gseg button');
    if (!b) return;
    const g = b.parentNode.dataset.g, v = b.dataset.v;
    if (g === 'auth') {
      if (v === 'demo' && !HT.state.user) { HT.api.loginDemo(); HT.toast('已用演示账号「阿青」登录'); }
      if (v === 'guest' && HT.state.user) { HT.api.logout(); HT.toast('已切换为游客'); }
      route(true);
    } else if (g === 'theme') {
      if (v !== theme()) { const r = b.getBoundingClientRect(); setTheme(v, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
    } else if (g === 'plaza') {
      HT.state.demo.plaza = v;
      if (HT.route.name !== 'plaza') HT.go('/'); else HT.bus.emit('demo');
      setTimeout(() => { const p = $('#plaza'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
    }
    syncGuide();
  });
  guideEl.addEventListener('change', (e) => {
    if (!e.target.matches('select[data-g="backend"]')) return;
    HT.api.setBackend(e.target.value);
    const b = HT.api.health().backend;
    HT.toast(`:9080 → ${b.name}（:${b.port}）`);
  });

  /* ---------------- 启动 ---------------- */
  HT.bus.on('auth', () => { renderHeader(); renderTabbar(); syncGuide(); markNav(false); });
  HT.bus.on('backend', () => {
    renderFooter();
    const s = $('#stack');
    if (s) { s.classList.remove('is-flip'); void s.offsetWidth; s.classList.add('is-flip'); }
  });
  HT.bus.on('theme', syncGuide);
  HT.bus.on('demo', syncGuide);

  renderHeader();
  renderFooter();
  renderTabbar();
  renderGuide();
  window.addEventListener('hashchange', () => route());
  route();
  onScroll();
})(window.HT);
