/* ============================================================
   应用外壳：页头 · 页脚（技术栈题记）· 移动端底栏 · 路由 · 主题 · 原型导览
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;
  const viewEl = $('#view');

  /* ---------------- 主题 ---------------- */
  const theme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  function setTheme(next, origin) {
    const apply = () => {
      document.documentElement.dataset.theme = next;
      HT.LS.set('theme', next);
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#131210' : '#F3EFE5';
      const btn = $('#themeBtn');
      if (btn) btn.setAttribute('aria-label', next === 'dark' ? '切换到日间主题' : '切换到夜间主题');
      HT.bus.emit('theme', next);
    };
    if (!document.startViewTransition || HT.reduced()) return apply();
    /* 以点击处为圆心晕开：像一盏灯被拧亮或熄灭 */
    const x = origin ? origin.x : innerWidth - 80, y = origin ? origin.y : 32;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('is-theming');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 560, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    vt.finished.finally(() => document.documentElement.classList.remove('is-theming'));
  }

  /* ---------------- 页头 ---------------- */
  function renderHeader() {
    const u = HT.state.user;
    const account = u ? `
      <div class="umenu" id="umenu">
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
      </div>` : `
      <a class="btn btn--text hdr__login" href="#/login">登录</a>
      <a class="btn btn--primary btn--sm" href="#/register">注册</a>`;
    $('#header').innerHTML = `
      <div class="wrap hdr__in">
        <a class="brand" href="#/" aria-label="HelloTime Pro 首页">${HT.logo()}<span class="brand__name latin">HelloTime</span><sup class="brand__pro mono">PRO</sup></a>
        <nav class="nav" aria-label="主导航">
          <a href="#/" data-nav="plaza">广场</a>
          <a href="#/open" data-nav="open">开启</a>
          <a href="#/about" data-nav="about">关于</a>
        </nav>
        <div class="hdr__act">
          <a class="btn btn--ghost btn--sm hdr__write" href="#/create" data-nav="create">${icon('pen')}写一枚</a>
          <button class="iconbtn theme" type="button" id="themeBtn" aria-label="${theme() === 'dark' ? '切换到日间主题' : '切换到夜间主题'}">${icon('sun', 'theme__sun')}${icon('moon', 'theme__moon')}</button>
          ${account}
        </div>
      </div>`;
    markNav();
  }

  /* ---------------- 页脚：把技术栈写成一页书的「版本记录」 ---------------- */
  function renderFooter() {
    const h = HT.api.health();
    const li = (it) => `<li title="${HT.ROLE_LABEL[it.role] || it.role}">${HT.techIcon(it)}<span>${esc(it.name)}</span><small class="mono">${esc(it.version || '')}</small></li>`;
    $('#footer').innerHTML = `
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
  }

  /* ---------------- 移动端底栏 ---------------- */
  function renderTabbar() {
    const u = HT.state.user;
    $('#tabbar').innerHTML = `
      <a href="#/" data-nav="plaza">${icon('grid')}<span>广场</span></a>
      <a href="#/open" data-nav="open">${icon('key')}<span>开启</span></a>
      <a href="#/create" data-nav="create" class="tabbar__main"><i>${icon('pen')}</i><span>写信</span></a>
      <a href="${u ? '#/me/created' : '#/login'}" data-nav="me">${u ? HT.avatar(u.avatarId) : icon('user')}<span>${u ? '我的' : '登录'}</span></a>`;
    markNav();
  }

  function markNav() {
    const nav = HT.route ? HT.route.nav : null;
    $$('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
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

    /* 守卫 */
    if (view.auth && !HT.state.user) { HT.toast('请先登录', { type: 'info' }); return replace('/login?redirect=' + encodeURIComponent(path)); }
    if (view.guest && HT.state.user) return replace(query.redirect || '/');
    if (name === 'me' && !params.tab) return replace('/me/created');

    const prev = cur ? cur.name : null;
    if (prev === 'plaza' && name !== 'plaza') plazaScroll = window.scrollY;
    HT.route = { path, name, nav: def ? def.nav : null };
    closeMenu();

    /* 同一视图内的子路由：只换局部 */
    if (!force && cur && cur.name === name && view.update && cur.page.isConnected) {
      view.update(cur.page, ctx);
      markNav();
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

    /* 从详情返回广场：回到离开时的位置 */
    const back = name === 'plaza' && prev === 'capsule' && plazaScroll > 0;
    window.scrollTo(0, back ? plazaScroll : 0);
    markNav();
  }
  HT.refresh = () => route(true);

  /* ---------------- 页头菜单 ---------------- */
  function closeMenu() {
    const m = $('#umenu');
    if (m) { m.classList.remove('is-open'); const c = $('#uchip'); if (c) c.setAttribute('aria-expanded', 'false'); }
  }

  document.addEventListener('click', (e) => {
    /* 主题 */
    const tb = e.target.closest('#themeBtn');
    if (tb) { const r = tb.getBoundingClientRect(); return setTheme(theme() === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }

    /* 用户菜单 */
    const chip = e.target.closest('#uchip');
    if (chip) { const m = $('#umenu'); const open = !m.classList.contains('is-open'); m.classList.toggle('is-open', open); chip.setAttribute('aria-expanded', String(open)); return; }
    if (e.target.closest('[data-hdr-logout]')) { HT.api.logout(); HT.toast('已登出'); if (location.hash === '#/' || location.hash === '') route(true); else HT.go('/'); return; }
    if (!e.target.closest('#umenu')) closeMenu();

    /* 收藏：全站统一处理（卡片、详情页共用） */
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
  const onScroll = () => hdr.classList.toggle('is-scrolled', window.scrollY > 6);
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- 原型导览：不是产品的一部分，只是方便评审时跳页与切状态 ---------------- */
  const guideEl = $('#guide');
  function renderGuide() {
    const link = (href, label, extra) => `<a href="${href}"${extra || ''}>${label}</a>`;
    guideEl.innerHTML = `
      <button class="guide__fab" type="button" id="guideFab" aria-expanded="false" aria-controls="guidePanel">${icon('compass')}<span>原型导览</span></button>
      <div class="guide__panel" id="guidePanel" role="dialog" aria-label="原型导览">
        <header class="guide__head"><div><b>原型导览</b><span>HelloTime Pro 2.0 ·「时笺」</span></div><button class="iconbtn" type="button" data-guide-x aria-label="关闭">${icon('x')}</button></header>
        <section class="guide__sec">
          <h4>页面直达</h4>
          <div class="guide__links">
            ${link('#/', '首页 · 胶囊广场')}${link('#/create', '创建胶囊', ' data-need="auth"')}${link('#/open', '开启胶囊')}
            ${link('#/c/SAMESONG', '详情 · 未开启', ' data-g-sealed')}${link('#/c/GK25WIND', '详情 · 已开启')}${link('#/c/NOSUCH00', '详情 · 查无此信')}
            ${link('#/login', '登录', ' data-need="guest"')}${link('#/register', '注册', ' data-need="guest"')}
            ${link('#/me/created', '我创建的', ' data-need="auth"')}${link('#/me/favorites', '我收藏的', ' data-need="auth"')}${link('#/me/profile', '账号设置', ' data-need="auth"')}
            ${link('#/about', '关于')}${link('#/design', '设计规范')}${link('#/nowhere', '404')}
          </div>
        </section>
        <section class="guide__sec">
          <h4>演示状态</h4>
          <div class="guide__row"><span>身份</span><div class="gseg" data-g="auth"><button type="button" data-v="guest">游客</button><button type="button" data-v="demo">已登录</button></div></div>
          <div class="guide__row"><span>主题</span><div class="gseg" data-g="theme"><button type="button" data-v="light">昼</button><button type="button" data-v="dark">夜</button></div></div>
          <div class="guide__row"><span>广场</span><div class="gseg" data-g="plaza"><button type="button" data-v="normal">正常</button><button type="button" data-v="loading">加载</button><button type="button" data-v="empty">空</button><button type="button" data-v="error">出错</button></div></div>
          <div class="guide__row"><span>后端</span><select data-g="backend" aria-label="模拟 :9080 指向的后端">${HT.BACKENDS.map((b) => `<option value="${b.key}">${b.name} · :${b.port}</option>`).join('')}</select></div>
        </section>
        <footer class="guide__foot"><button class="linkbtn" type="button" data-g-reset>${icon('refresh')}重置原型数据</button><span>数据只存在本机浏览器</span></footer>
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
      /* 直达需要登录 / 需要游客身份的页面时，先替评审把身份切好 */
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
  HT.bus.on('auth', () => { renderHeader(); renderTabbar(); syncGuide(); });
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
