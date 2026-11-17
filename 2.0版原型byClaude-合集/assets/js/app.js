/* ============================================================
   共享外壳：路由 · 守卫 · 主题（明 / 暗）· 皮肤（时笺 / 琥珀）· 收藏 · 原型导览
   皮肤只提供标记（shell / views / ui），所有事件与状态都在这里统一处理
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;
  const viewEl = $('#view');
  const root = document.documentElement;

  /* ---------------- 主题：明 / 暗 ---------------- */
  const theme = () => root.dataset.theme === 'light' ? 'light' : 'dark';
  function syncThemeMeta() {
    const meta = $('meta[name="theme-color"]');
    const S = HT.cur();
    if (meta && S.themeColor) meta.content = S.themeColor[theme()];
  }
  function setTheme(next, origin) {
    const apply = () => {
      root.dataset.theme = next;
      HT.LS.set('theme', next);
      syncThemeMeta();
      const btn = $('#themeBtn');
      if (btn && btn.getAttribute('role') === 'switch') {
        btn.setAttribute('aria-checked', String(next === 'light'));
        btn.setAttribute('aria-label', next === 'light' ? '当前为晨曦（亮色），切换到星夜' : '当前为星夜（暗色），切换到晨曦');
      } else if (btn) btn.setAttribute('aria-label', next === 'dark' ? '切换到日间主题' : '切换到夜间主题');
      HT.bus.emit('theme', next);
    };
    if (!document.startViewTransition || HT.reduced()) return apply();
    /* 以点击处为圆心晕开：一盏灯被拧亮或熄灭 */
    const x = origin ? origin.x : innerWidth - 80, y = origin ? origin.y : 32;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('is-theming');
    let done = false;
    const run = () => { if (done) return; done = true; apply(); };
    const vt = document.startViewTransition(run);
    setTimeout(run, 400);
    vt.ready.then(() => {
      root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.65, 0, .35, 1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('is-theming'));
  }

  /* ---------------- 皮肤：时笺 / 琥珀 ---------------- */
  function activateSkin(name) {
    const prev = HT.skins[root.dataset.skin];
    if (prev && prev.name !== name) prev.leave();
    HT.state.skin = name;
    root.dataset.skin = name;
    HT.LS.set('skin', name);
    /* 样式不用切换：spec/styles 里两套皮肤的选择器都按 data-skin 限定，改了上面的属性就生效 */
    /* 视觉部件并入 HT：页面里的 HT.card、HT.avatar 等从此指向这套皮肤 */
    Object.assign(HT, HT.skins[name].ui);
    HT.skins[name].enter();
    syncThemeMeta();
  }
  function setSkin(name) {
    if (!HT.skins[name] || name === HT.state.skin) return;
    const apply = () => {
      activateSkin(name);
      renderHeader(); renderFooter(); renderTabbar(); renderGuide();
      route(true, true);
      HT.bus.emit('skin', name);
    };
    if (!document.startViewTransition || HT.reduced()) { apply(); HT.toast(`已切换到「${HT.SKIN_LABEL[name]}」`); return; }
    root.classList.add('is-skinning');
    /* 兜底：页面在后台时渲染被节流，转场回调可能迟迟不执行——400ms 内没跑就直接切 */
    let done = false;
    const run = () => { if (done) return; done = true; apply(); };
    const vt = document.startViewTransition(run);
    setTimeout(run, 400);
    vt.finished.finally(() => { root.classList.remove('is-skinning'); HT.toast(`已切换到「${HT.SKIN_LABEL[name]}」`); });
  }
  HT.setSkin = setSkin;

  const skinSwitch = () => `<div class="skinsw" id="skinSw" role="radiogroup" aria-label="界面皮肤">
      ${['paper', 'amber'].map((k) => `<button type="button" role="radio" data-skin="${k}" aria-checked="${HT.state.skin === k}" class="${HT.state.skin === k ? 'is-active' : ''}" title="切换到「${HT.SKIN_LABEL[k]}」">${HT.SKIN_LABEL[k]}</button>`).join('')}
    </div>`;

  /* ---------------- 外壳渲染 ---------------- */
  function renderHeader() {
    $('#header').innerHTML = HT.cur().shell.header({ user: HT.state.user, theme: theme(), skinSw: skinSwitch() });
    markNav(false);
  }
  function renderFooter() { $('#footer').innerHTML = HT.cur().shell.footer(); }
  function renderTabbar() { $('#tabbar').innerHTML = HT.cur().shell.tabbar({ user: HT.state.user }); markNav(false); }

  /* 导航高亮底（「琥珀」皮肤有）：跟着当前页滑过去 */
  function placeInk(animate) {
    const nav = $('#nav');
    if (!nav) return;
    const ink = $('.nav__ink', nav), a = $('.nav__link.is-active', nav);
    if (!ink) return;
    if (!a) { ink.style.opacity = 0; return; }
    if (!animate) ink.style.transition = 'none';
    ink.style.opacity = 1;
    ink.style.width = a.offsetWidth + 'px';
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    if (!animate) { void ink.offsetWidth; ink.style.transition = ''; }
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
    { re: /^\/capsules\/([A-Za-z0-9]{1,16})$/, view: 'capsule', keys: ['code'], nav: 'open' },
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

  /* force：重新挂载当前页；keepScroll：切换皮肤时尽量停在原处 */
  function route(force, keepScroll) {
    const { path, query } = parse();
    let def = null, m = null;
    for (const r of ROUTES) { m = r.re.exec(path); if (m) { def = r; break; } }
    const params = {};
    if (def && def.keys) def.keys.forEach((k, i) => { params[k] = m[i + 1]; });
    const name = def ? def.view : 'notfound';
    const view = HT.cur().views[name];
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

    const y = window.scrollY;
    if (cur && cur.cleanup) { try { cur.cleanup(); } catch (e) { console.error(e); } }
    HT.tick.clear();
    $$('.dlg, .cer').forEach((d) => d.remove());

    document.title = (view.title ? view.title + ' · ' : '') + 'HelloTime Pro';
    document.body.dataset.route = name;
    viewEl.innerHTML = view.render(ctx);
    const page = viewEl.firstElementChild;
    const cleanup = view.mount ? view.mount(page, ctx) : null;
    cur = { name, page, cleanup: typeof cleanup === 'function' ? cleanup : null };

    const back = name === 'plaza' && prev === 'capsule' && plazaScroll > 0;
    window.scrollTo(0, keepScroll ? Math.min(y, document.documentElement.scrollHeight) : back ? plazaScroll : 0);
    markNav(!keepScroll);
  }
  HT.refresh = () => route(true);

  function closeMenu() {
    const m = $('#umenu');
    if (m) { m.classList.remove('is-open'); const c = $('#uchip'); if (c) c.setAttribute('aria-expanded', 'false'); }
  }

  /* ---------------- 全局事件 ---------------- */
  document.addEventListener('click', (e) => {
    const sk = e.target.closest('#skinSw [data-skin]');
    if (sk) return setSkin(sk.dataset.skin);

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

    /* 收藏：两套皮肤、卡片与详情页共用这一处 */
    const fb = e.target.closest('[data-fav]');
    if (fb) {
      e.preventDefault();
      const id = fb.dataset.fav;
      if (!HT.state.user) return HT.askLogin('登录后才能收藏');
      const c = HT.api.byId(id, true);
      if (!c) return;
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
  window.addEventListener('resize', () => placeInk(false));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInk(false));

  /* ---------------- 原型导览（不属于产品，方便评审跳页与切状态） ---------------- */
  const guideEl = $('#guide');
  function renderGuide() {
    const link = (href, label, extra) => `<a href="${href}"${extra || ''}>${label}</a>`;
    const L = HT.cur().themeLabel || { light: '亮', dark: '暗' };
    guideEl.innerHTML = `
      <button class="guide__fab" type="button" id="guideFab" aria-expanded="false" aria-controls="guidePanel">${icon('compass')}<span>原型导览</span></button>
      <div class="guide__panel" id="guidePanel" role="dialog" aria-label="原型导览">
        <header class="guide__head"><div><b>原型导览</b><span>HelloTime Pro 2.0 · 双皮肤合集</span></div><button class="iconbtn icon-btn" type="button" data-guide-x aria-label="关闭">${icon('x')}</button></header>
        <section class="guide__sec">
          <h4>页面直达</h4>
          <div class="guide__links">
            ${link('#/', '首页 · 胶囊广场')}${link('#/create', '写一枚胶囊', ' data-need="auth"')}${link('#/open', '开启胶囊')}
            ${link('#/capsules/SAMESONG', '详情 · 未开启', ' data-g-sealed')}${link('#/capsules/GK25WIND', '详情 · 已开启')}${link('#/capsules/NOSUCH00', '详情 · 查无此码')}
            ${link('#/login', '登录', ' data-need="guest"')}${link('#/register', '注册', ' data-need="guest"')}
            ${link('#/me/created', '我创建的', ' data-need="auth"')}${link('#/me/favorites', '我收藏的', ' data-need="auth"')}${link('#/me/profile', '账号设置', ' data-need="auth"')}
            ${link('#/about', '关于')}${link('#/design', '设计规范')}${link('#/nowhere', '404')}
          </div>
        </section>
        <section class="guide__sec">
          <h4>演示状态</h4>
          <div class="guide__row"><span>皮肤</span><div class="gseg" data-g="skin"><button type="button" data-v="paper">时笺</button><button type="button" data-v="amber">琥珀</button></div></div>
          <div class="guide__row"><span>主题</span><div class="gseg" data-g="theme"><button type="button" data-v="light">${L.light}</button><button type="button" data-v="dark">${L.dark}</button></div></div>
          <div class="guide__row"><span>身份</span><div class="gseg" data-g="auth"><button type="button" data-v="guest">游客</button><button type="button" data-v="demo">已登录</button></div></div>
          <div class="guide__row"><span>广场</span><div class="gseg" data-g="plaza"><button type="button" data-v="normal">正常</button><button type="button" data-v="loading">加载</button><button type="button" data-v="empty">空</button><button type="button" data-v="error">出错</button></div></div>
          <div class="guide__row"><span>后端</span><div class="select select--sm"><select data-g="backend" aria-label="模拟 :9080 指向的后端">${HT.BACKENDS.map((b) => `<option value="${b.key}">${b.name} · :${b.port}</option>`).join('')}</select>${icon('chev-down', 'select__arrow')}</div></div>
        </section>
        <footer class="guide__foot"><button class="linkbtn link-btn" type="button" data-g-reset>${icon('refresh')}重置原型数据</button><span>数据只存在本机浏览器</span></footer>
      </div>`;
    syncGuide();
  }
  function syncGuide() {
    const set = (g, v) => $$(`[data-g="${g}"] button`, guideEl).forEach((b) => b.classList.toggle('is-active', b.dataset.v === v));
    set('skin', HT.state.skin);
    set('auth', HT.state.user ? 'demo' : 'guest');
    set('theme', theme());
    set('plaza', HT.state.demo.plaza);
    const sel = $('select[data-g="backend"]', guideEl);
    if (sel) sel.value = HT.state.backend;
    const hot = HT.api.featured();
    const sealed = $('[data-g-sealed]', guideEl);
    if (sealed && hot) sealed.setAttribute('href', '#/capsules/' + hot.code);
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
    if (g === 'skin') {
      setSkin(v);
      setTimeout(() => { guideEl.classList.add('is-open'); syncGuide(); }, 60);
      return;
    }
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

  activateSkin(HT.state.skin);
  renderHeader();
  renderFooter();
  renderTabbar();
  renderGuide();
  window.addEventListener('hashchange', () => route());
  route();
  onScroll();
})(window.HT);
