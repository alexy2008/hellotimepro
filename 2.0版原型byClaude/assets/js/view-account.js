/* ============================================================
   登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, sleep } = HT;

  /* ---------------- 表单小件 ---------------- */

  const field = ({ id, label, type, hint, attrs, value, trail }) => `
    <div class="field" data-field="${id}">
      <label class="field__label" for="${id}">${label}</label>
      <div class="field__box">
        <input class="field__input" id="${id}" name="${id}" type="${type || 'text'}" value="${esc(value || '')}" ${attrs || ''} aria-describedby="${id}-hint">
        ${trail || ''}
        <span class="field__line"></span>
      </div>
      <div class="field__hint" id="${id}-hint" data-hint="${esc(hint || '')}">${hint || ''}</div>
    </div>`;

  const eye = `<button class="field__eye" type="button" data-eye aria-label="显示密码">${icon('eye')}</button>`;
  const nickState = '<span class="field__state" data-nick-state aria-hidden="true"></span>';

  function setErr(root, id, msg) {
    const f = $(`[data-field="${id}"]`, root);
    if (!f) return;
    const h = $('.field__hint', f);
    f.classList.toggle('is-error', !!msg);
    f.classList.remove('is-ok');
    h.textContent = msg || h.dataset.hint;
    if (msg) HT.shake($('.field__box', f));
  }
  function setOk(root, id, msg) {
    const f = $(`[data-field="${id}"]`, root);
    if (!f) return;
    f.classList.remove('is-error');
    f.classList.add('is-ok');
    $('.field__hint', f).textContent = msg;
  }

  function bindEyes(root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-eye]');
      if (!b) return;
      const inp = $('input', b.parentNode);
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = icon(show ? 'eye-off' : 'eye');
      b.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
    });
  }

  const rules = (id) => `<ul class="rules" data-rules="${id}" aria-hidden="true"><li data-rule="len">至少 8 位</li><li data-rule="alpha">含字母</li><li data-rule="digit">含数字</li></ul>`;
  const pwdOk = (v) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
  function bindRules(root, inputId) {
    const inp = $('#' + inputId, root), list = $(`[data-rules="${inputId}"]`, root);
    const paint = () => { const r = pwdOk(inp.value); $$('[data-rule]', list).forEach((li) => li.classList.toggle('is-ok', r[li.dataset.rule])); };
    inp.addEventListener('input', paint);
    paint();
  }

  /* 头像选择：十枚邮票，选中的那枚会在右下角被盖上一枚带对勾的小邮戳 */
  const CANCEL = '<svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true"><circle cx="51" cy="65" r="14.5"/><circle cx="51" cy="65" r="10.5"/><path d="M45.5 65.5l4 4 7.5-8.5"/></svg>';
  function avatarPicker(sel) {
    const cur = HT.avatarOf(sel);
    return `<div class="avpick" role="radiogroup" aria-label="选择头像" data-avpick>
        ${HT.AVATARS.map((a) => `<button type="button" class="avpick__it${a.id === sel ? ' is-sel' : ''}" role="radio" aria-checked="${a.id === sel}" tabindex="${a.id === sel ? 0 : -1}" data-av="${a.id}" aria-label="${a.name}，${a.tagline}">${HT.stamp(a.id)}${CANCEL}</button>`).join('')}
      </div>
      <div class="avpick__cap" data-avcap><b>${cur.name}</b><span>${cur.tagline}</span></div>`;
  }
  function bindAvatarPicker(root, onPick) {
    const box = $('[data-avpick]', root);
    const pick = (id, focus) => {
      $$('.avpick__it', box).forEach((b) => {
        const on = b.dataset.av === id;
        b.classList.toggle('is-sel', on);
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      const a = HT.avatarOf(id);
      $('[data-avcap]', root).innerHTML = `<b>${a.name}</b><span>${a.tagline}</span>`;
      onPick(id);
    };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-av]'); if (b) pick(b.dataset.av); });
    box.addEventListener('keydown', (e) => {
      const ids = HT.AVATARS.map((a) => a.id);
      const i = ids.indexOf(($('.avpick__it.is-sel', box) || {}).dataset ? $('.avpick__it.is-sel', box).dataset.av : ids[0]);
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % ids.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + ids.length) % ids.length;
      if (n == null) return;
      e.preventDefault();
      pick(ids[n], true);
    });
    return { pick };
  }

  /* 昵称：格式校验 + 模拟「唯一性」异步检查 */
  function bindNickname(root, inputId, exceptId) {
    const inp = $('#' + inputId, root);
    const st = $('[data-nick-state]', root);
    let timer = 0, seq = 0;
    const api = { valid: false };
    function check() {
      const v = inp.value.trim();
      clearTimeout(timer);
      const my = ++seq;
      st.className = 'field__state';
      api.valid = false;
      const hint = $(`[data-field="${inputId}"] .field__hint`, root);
      setErr(root, inputId, '');
      if (!v) return;
      if (Array.from(v).length < 2) { hint.textContent = '至少 2 个字符'; return; }
      if (!/^[一-龥A-Za-z0-9_-]{2,20}$/.test(v)) { setErr(root, inputId, '只能用中英文、数字、下划线和连字符'); return; }
      hint.textContent = '正在检查昵称是否可用…';
      st.classList.add('is-busy');
      timer = setTimeout(() => {
        if (my !== seq) return;
        st.classList.remove('is-busy');
        if (HT.api.nicknameTaken(v, exceptId)) { st.classList.add('is-bad'); st.innerHTML = icon('x'); setErr(root, inputId, `「${v}」已经有人用了，换一个吧`); }
        else { st.classList.add('is-good'); st.innerHTML = icon('check'); setOk(root, inputId, '这个昵称可以用'); api.valid = true; }
      }, 520);
    }
    inp.addEventListener('input', check);
    return api;
  }

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function busyBtn(btn, label, ms) {
    btn.disabled = true; btn.classList.add('is-busy');
    const span = $('span', btn), old = span.textContent;
    span.textContent = label;
    await sleep(ms || 640);
    return () => { btn.disabled = false; btn.classList.remove('is-busy'); span.textContent = old; };
  }

  /* 登录 / 注册 共用的左侧题字 */
  const artPanel = (poem, src, sealCh) => `
    <aside class="auth__art" aria-hidden="true">
      <div class="auth__brand">${HT.logo()}<span class="latin">HelloTime</span></div>
      <div class="auth__poem serif">${poem.map((l) => `<span>${l}</span>`).join('')}</div>
      <div class="auth__foot"><span>${src}</span>${HT.seal(sealCh, 'solid', 'auth__seal')}</div>
      <div class="auth__pm">${HT.postmark({ line1: fmt.date(Date.now()), line2: '此 刻', cls: 'pm--auth' })}</div>
    </aside>`;

  HT.views = HT.views || {};

  /* ---------------- 登录 ---------------- */
  HT.views.login = {
    title: '登录',
    guest: true,
    render(ctx) {
      return `<div class="page page--auth"><div class="auth">
        ${artPanel(['见字如面', '展信安好'], '写信的人，在等回信的你', '信')}
        <section class="auth__main"><div class="auth__card">
          <div class="overline"><i></i>Sign in</div>
          <h1 class="h1">欢迎回来</h1>
          <p class="lede">你留给未来的信，还在等你开启。</p>
          ${ctx.query.redirect ? `<p class="note note--inline">${icon('info')}<span>登录后会带你回到刚才的页面。</span></p>` : ''}
          <form id="form" novalidate>
            ${field({ id: 'email', label: '邮箱', type: 'email', attrs: 'autocomplete="email" placeholder="you@example.com" required' })}
            ${field({ id: 'password', label: '密码', type: 'password', attrs: 'autocomplete="current-password" placeholder="输入密码" required', trail: eye, hint: '忘记密码？当前版本暂不支持找回。' })}
            <div class="form__err" id="formErr" role="alert"></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit"><span>登录</span>${icon('arrow', 'ic--go')}</button>
          </form>
          <p class="auth__alt">还没有账号？<a class="link" href="#/register${ctx.query.redirect ? '?redirect=' + encodeURIComponent(ctx.query.redirect) : ''}">注册一个</a></p>
          <div class="proto proto--left">原型演示 ·<button class="proto__btn" type="button" data-demo>填入演示账号「阿青」${icon('arrow')}</button></div>
        </div></section>
      </div></div>`;
    },
    mount(page, ctx) {
      const form = $('#form', page), err = $('#formErr', page);
      bindEyes(page);
      form.addEventListener('input', () => { err.textContent = ''; });
      $('[data-demo]', page).addEventListener('click', async () => {
        const type = async (el, text) => { el.value = ''; for (const ch of text) { el.value += ch; await sleep(18); } };
        await type($('#email', page), HT.DEMO_ACCOUNT.email);
        await type($('#password', page), HT.DEMO_ACCOUNT.password);
        $('button[type="submit"]', form).focus();
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('#email', page).value, pwd = $('#password', page).value;
        setErr(page, 'email', ''); setErr(page, 'password', '');
        if (!emailOk(email)) return setErr(page, 'email', '请输入有效的邮箱地址');
        if (!pwd) return setErr(page, 'password', '请输入密码');
        const done = await busyBtn($('button[type="submit"]', form), '登录中…');
        try {
          const u = HT.api.login(email, pwd);
          HT.toast(`欢迎回来，${u.nickname}`);
          HT.go(ctx.query.redirect || '/me/created');
        } catch (ex) {
          done();
          err.textContent = ex.message;      // 不区分「邮箱不存在」与「密码错误」
          HT.shake(form);
        }
      });
      setTimeout(() => { if (page.isConnected) $('#email', page).focus({ preventScroll: true }); }, 380);
    },
  };

  /* ---------------- 注册 ---------------- */
  HT.views.register = {
    title: '注册',
    guest: true,
    render(ctx) {
      return `<div class="page page--auth"><div class="auth">
        ${artPanel(['纸短情长', '来日方长'], '先留个名字，再慢慢写', '缄')}
        <section class="auth__main"><div class="auth__card auth__card--wide">
          <div class="overline"><i></i>Sign up</div>
          <h1 class="h1">领一个信箱</h1>
          <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>
          <form id="form" novalidate>
            <div class="form__row">
              ${field({ id: 'email', label: '邮箱', type: 'email', attrs: 'autocomplete="email" placeholder="you@example.com" required', hint: '作为登录账号，注册后不可修改。' })}
              ${field({ id: 'nickname', label: '昵称', attrs: 'maxlength="20" autocomplete="nickname" placeholder="2–20 个字符" required', hint: '全站唯一，注册后可以改。', trail: nickState })}
            </div>
            ${field({ id: 'password', label: '密码', type: 'password', attrs: 'autocomplete="new-password" placeholder="设置密码" required', trail: eye })}
            ${rules('password')}
            <div class="field field--plain">
              <span class="field__label" id="av-label">邮票头像 <small>十选一，不支持上传</small></span>
              ${avatarPicker('neo')}
            </div>
            <div class="form__err" id="formErr" role="alert"></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit"><span>创建账号，开始写信</span>${icon('arrow', 'ic--go')}</button>
          </form>
          <p class="auth__alt">已经有账号？<a class="link" href="#/login${ctx.query.redirect ? '?redirect=' + encodeURIComponent(ctx.query.redirect) : ''}">去登录</a></p>
        </div></section>
      </div></div>`;
    },
    mount(page, ctx) {
      const form = $('#form', page), err = $('#formErr', page);
      let avatarId = 'neo';
      bindEyes(page);
      bindRules(page, 'password');
      bindAvatarPicker(page, (id) => { avatarId = id; });
      const nick = bindNickname(page, 'nickname');
      $('#email', page).addEventListener('blur', (e) => {
        const v = e.target.value;
        if (!v) return;
        if (!emailOk(v)) setErr(page, 'email', '邮箱格式不太对');
        else if (HT.api.emailTaken(v)) setErr(page, 'email', '这个邮箱已经注册过了');
        else setOk(page, 'email', '作为登录账号，注册后不可修改。');
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';
        const email = $('#email', page).value, nickname = $('#nickname', page).value.trim(), pwd = $('#password', page).value;
        if (!emailOk(email)) return setErr(page, 'email', '请输入有效的邮箱地址');
        if (HT.api.emailTaken(email)) return setErr(page, 'email', '这个邮箱已经注册过了');
        if (!/^[一-龥A-Za-z0-9_-]{2,20}$/.test(nickname)) return setErr(page, 'nickname', '昵称需为 2–20 个字符：中英文、数字、下划线或连字符');
        if (HT.api.nicknameTaken(nickname)) return setErr(page, 'nickname', `「${nickname}」已经有人用了，换一个吧`);
        const r = pwdOk(pwd);
        if (!(r.len && r.alpha && r.digit)) { HT.shake($('[data-rules="password"]', page)); return setErr(page, 'password', '密码至少 8 位，且同时包含字母和数字'); }
        const done = await busyBtn($('button[type="submit"]', form), '正在创建…', 760);
        try {
          const u = HT.api.register({ email, password: pwd, nickname, avatarId });
          HT.toast(`你好，${u.nickname}。信箱领好了`);
          HT.go(ctx.query.redirect || '/create');
        } catch (ex) {
          done();
          if (ex.field) setErr(page, ex.field, ex.message); else err.textContent = ex.message;
        }
      });
      void nick;
      setTimeout(() => { if (page.isConnected) $('#email', page).focus({ preventScroll: true }); }, 380);
    },
  };

  /* ---------------- 我的 ---------------- */

  function meHead() {
    const me = HT.state.user;
    const mine = HT.api.mine();
    const waiting = mine.filter((c) => !c.isOpened).length;
    const loved = mine.reduce((n, c) => n + c.favoriteCount, 0);
    return `<header class="me__head">
      <div class="me__id">
        ${HT.stamp(me.avatarId, 'stamp--lg')}
        <div>
          <div class="overline"><i></i>My desk</div>
          <h1 class="h1">${esc(me.nickname)}</h1>
          <p class="me__mail"><span class="mono">${esc(me.email)}</span><span>${fmt.cn(me.createdAt)} 加入</span></p>
        </div>
      </div>
      <dl class="me__stats">
        <div><dd class="latin">${mine.length}</dd><dt>写下的胶囊</dt></div>
        <div><dd class="latin">${waiting}</dd><dt>还在等待启封</dt></div>
        <div><dd class="latin">${fmt.num(loved)}</dd><dt>被收藏的次数</dt></div>
      </dl>
    </header>`;
  }

  function meTabs(tab) {
    const it = (key, label, n) => `<a class="tabs__it${tab === key ? ' is-active' : ''}" href="#/me/${key}" data-tab="${key}"${tab === key ? ' aria-current="page"' : ''}>${label}${n != null ? `<sup>${n}</sup>` : ''}</a>`;
    return `<nav class="tabs" id="meTabs" aria-label="我的">
      ${it('created', '我创建的', HT.api.mine().length)}${it('favorites', '我收藏的', HT.api.favorites().length)}${it('profile', '账号设置')}
      <span class="tabs__ink" aria-hidden="true"></span>
      <button class="linkbtn tabs__out" type="button" data-logout>${icon('logout')}登出</button>
    </nav>`;
  }

  function createdHTML() {
    const list = HT.api.mine();
    if (!list.length) {
      return `<div class="empty empty--inline">${HT.seal('空', 'line')}<h3>还没有写下任何胶囊</h3><p>第一封信，写给一年后的自己怎么样？</p><a class="btn btn--primary" href="#/create">${icon('pen')}写一枚胶囊</a></div>`;
    }
    const now = Date.now();
    return `<div class="me__bar"><span>按创建时间倒序 · 共 ${list.length} 枚</span><a class="btn btn--primary btn--sm" href="#/create">${icon('plus')}新建胶囊</a></div>
      <ul class="ledger">
        ${list.map((c, i) => {
          const cd = fmt.cd(c.openAt, now);
          const when = c.isOpened
            ? `<div class="ledger__when"><span class="ledger__k">已启封</span><b>${fmt.date(c.openAt)}</b><small>在途 ${fmt.span(c.openAt - c.createdAt)}</small></div>`
            : `<div class="ledger__when"><span class="ledger__k">距启封</span><b data-cd-plain="${c.openAt}">${cd.d > 0 ? `<span class="latin">${fmt.num(cd.d)}</span> 天` : `<span class="mono">${HT.pad2(cd.h)}:${HT.pad2(cd.m)}:${HT.pad2(cd.s)}</span>`}</b>${HT.scale(fmt.progress(c, now))}</div>`;
          return `<li class="ledger__row" data-id="${c.id}" style="--i:${i}">
            <div class="ledger__seal">${HT.seal(c.isOpened ? '启' : '封', c.isOpened ? 'line' : 'solid')}</div>
            <div class="ledger__main">
              <a class="ledger__title serif" href="#/c/${c.code}">${esc(c.title)}</a>
              <div class="ledger__sub">
                <button class="ledger__code mono" type="button" data-copy="${c.code}" title="点击复制胶囊码">${c.code}${icon('copy')}</button>
                ${c.inPlaza ? `<span class="tag">${icon('globe')}广场公开</span>` : `<span class="tag tag--quiet">${icon('lock')}仅凭码可见</span>`}
                <span>封存于 ${fmt.date(c.createdAt)}</span>
              </div>
            </div>
            ${when}
            <div class="ledger__fav" title="被收藏 ${c.favoriteCount} 次">${icon('heart')}<span class="latin">${fmt.num(c.favoriteCount)}</span></div>
            <div class="ledger__act">
              <a class="btn btn--text" href="#/c/${c.code}">查看</a>
              <button class="btn btn--text btn--danger" type="button" data-withdraw="${c.id}">撤回</button>
            </div>
          </li>`;
        }).join('')}
      </ul>
      <p class="me__fine">${icon('info')}胶囊的内容与启封时刻一经封存就不可修改；你可以随时撤回（删除）自己写的胶囊，无论它是否已经启封。</p>`;
  }

  function favoritesHTML() {
    const list = HT.api.favorites();
    if (!list.length) {
      return `<div class="empty empty--inline">${HT.seal('藏', 'line')}<h3>还没有收藏</h3><p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p><a class="btn btn--primary" href="#/">去广场逛逛${icon('arrow', 'ic--go')}</a></div>`;
    }
    return `<div class="me__bar"><span>按收藏时间倒序 · 共 ${list.length} 枚</span><a class="btn btn--ghost btn--sm" href="#/">去广场逛逛</a></div>
      <div class="grid grid--me">${list.map((c, i) => HT.card(c, { i })).join('')}</div>`;
  }

  function profileHTML() {
    const me = HT.state.user;
    return `<div class="profile">
      <section class="pane">
        <h2 class="pane__h">基本信息</h2>
        <form id="profileForm" novalidate>
          ${field({ id: 'p-email', label: '邮箱', type: 'email', value: me.email, attrs: 'disabled', hint: '邮箱是登录账号，不可修改。', trail: `<span class="field__state is-lock" aria-hidden="true">${icon('lock')}</span>` })}
          ${field({ id: 'p-nick', label: '昵称', value: me.nickname, attrs: 'maxlength="20" autocomplete="nickname"', hint: '2–20 个字符，全站唯一。', trail: nickState })}
          <div class="field field--plain">
            <span class="field__label">邮票头像</span>
            ${avatarPicker(me.avatarId)}
          </div>
          <div class="form__msg" id="profileMsg" role="status"></div>
          <div class="pane__act">
            <button class="btn btn--ghost" type="button" data-reset>重置</button>
            <button class="btn btn--primary" type="submit"><span>保存更改</span></button>
          </div>
        </form>
      </section>

      <section class="pane">
        <h2 class="pane__h">修改密码</h2>
        <form id="pwdForm" novalidate>
          ${field({ id: 'pw-cur', label: '当前密码', type: 'password', attrs: 'autocomplete="current-password"', trail: eye })}
          ${field({ id: 'pw-new', label: '新密码', type: 'password', attrs: 'autocomplete="new-password"', trail: eye })}
          ${rules('pw-new')}
          ${field({ id: 'pw-again', label: '再输一次新密码', type: 'password', attrs: 'autocomplete="new-password"', trail: eye })}
          <div class="form__msg" id="pwdMsg" role="status"></div>
          <p class="pane__fine">${icon('info')}修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</p>
          <div class="pane__act"><button class="btn btn--primary" type="submit"><span>更新密码</span></button></div>
        </form>
      </section>
    </div>`;
  }

  const BODY = { created: createdHTML, favorites: favoritesHTML, profile: profileHTML };

  function placeInk(page, animate) {
    const nav = $('#meTabs', page), a = $('.tabs__it.is-active', nav), ink = $('.tabs__ink', nav);
    if (!a || !ink) return;
    if (!animate) ink.style.transition = 'none';
    ink.style.width = a.offsetWidth + 'px';
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    if (!animate) { void ink.offsetWidth; ink.style.transition = ''; }
  }

  function mountProfile(page) {
    const me = HT.state.user;
    let avatarId = me.avatarId;
    const picker = bindAvatarPicker(page, (id) => { avatarId = id; });
    bindNickname(page, 'p-nick', me.id);
    bindRules(page, 'pw-new');
    const msg = (id, type, text) => { const el = $('#' + id, page); el.className = 'form__msg' + (type ? ' is-' + type : ''); el.innerHTML = text ? `${icon(type === 'err' ? 'alert' : type === 'ok' ? 'check' : 'info')}<span>${text}</span>` : ''; };

    $('#profileForm', page).addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = HT.state.user;
      const nickname = $('#p-nick', page).value.trim();
      const patch = {};
      if (nickname !== cur.nickname) patch.nickname = nickname;
      if (avatarId !== cur.avatarId) patch.avatarId = avatarId;
      if (!Object.keys(patch).length) return msg('profileMsg', 'info', '没有改动');
      if (patch.nickname != null && !/^[一-龥A-Za-z0-9_-]{2,20}$/.test(nickname)) return setErr(page, 'p-nick', '昵称需为 2–20 个字符：中英文、数字、下划线或连字符');
      const done = await busyBtn($('#profileForm button[type="submit"]', page), '保存中…', 520);
      try {
        HT.api.updateProfile(patch);
        done();
        msg('profileMsg', 'ok', '已保存');
        HT.toast('资料已更新');
        $('.me__head', page).outerHTML = meHead();
      } catch (ex) { done(); if (ex.field === 'nickname') setErr(page, 'p-nick', ex.message); else msg('profileMsg', 'err', ex.message); }
    });
    $('[data-reset]', page).addEventListener('click', () => {
      const cur = HT.state.user;
      $('#p-nick', page).value = cur.nickname;
      setErr(page, 'p-nick', '');
      $('[data-nick-state]', page).className = 'field__state';
      picker.pick(cur.avatarId);
      msg('profileMsg', '', '');
    });

    $('#pwdForm', page).addEventListener('submit', async (e) => {
      e.preventDefault();
      ['pw-cur', 'pw-new', 'pw-again'].forEach((id) => setErr(page, id, ''));
      const cur = $('#pw-cur', page).value, nw = $('#pw-new', page).value, again = $('#pw-again', page).value;
      if (!cur) return setErr(page, 'pw-cur', '请输入当前密码');
      const r = pwdOk(nw);
      if (!(r.len && r.alpha && r.digit)) return setErr(page, 'pw-new', '新密码至少 8 位，且同时包含字母和数字');
      if (nw !== again) return setErr(page, 'pw-again', '两次输入的新密码不一致');
      const done = await busyBtn($('#pwdForm button[type="submit"]', page), '更新中…', 620);
      try {
        HT.api.changePassword(cur, nw);
        msg('pwdMsg', 'ok', '密码已更新。3 秒后将自动登出，请用新密码重新登录。');
        setTimeout(() => { if (!page.isConnected) return; HT.api.logout(); HT.go('/login'); }, 3000);
      } catch (ex) { done(); setErr(page, 'pw-cur', ex.message); }
    });
  }

  HT.views.me = {
    title: '我的',
    auth: true,
    render(ctx) {
      const tab = BODY[ctx.params.tab] ? ctx.params.tab : 'created';
      return `<div class="page page--me"><div class="wrap me">
        ${meHead()}
        ${meTabs(tab)}
        <div class="me__body" id="meBody" data-tab="${tab}">${BODY[tab]()}</div>
      </div></div>`;
    },

    mount(page, ctx) {
      const tab = () => $('#meBody', page).dataset.tab;
      bindEyes(page);
      placeInk(page, false);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeInk(page, false));
      const onResize = () => placeInk(page, false);
      window.addEventListener('resize', onResize);
      if (tab() === 'profile') mountProfile(page);

      const refreshCounts = () => { $('.me__head', page).outerHTML = meHead(); $('#meTabs', page).outerHTML = meTabs(tab()); placeInk(page, false); };

      page.addEventListener('click', async (e) => {
        const cp = e.target.closest('[data-copy]');
        if (cp) return HT.copy(cp.dataset.copy, `已复制胶囊码 ${cp.dataset.copy}`);

        if (e.target.closest('[data-logout]')) {
          HT.api.logout();
          HT.toast('已登出');
          return HT.go('/');
        }

        const wd = e.target.closest('[data-withdraw]');
        if (wd) {
          const c = HT.api.byId(wd.dataset.withdraw, true);
          const ok = await HT.dialog({
            title: '撤回这枚胶囊？',
            body: `<p>《${esc(c.title)}》会被永久删除，持有胶囊码 <b class="mono">${c.code}</b> 的人也将无法再打开它。</p><p class="dlg__warn">${icon('alert')}此操作不可恢复。</p>`,
            confirm: '撤回', cancel: '再想想', tone: 'danger',
            mark: `<div class="dlg__mark">${HT.seal('撤', 'line')}</div>`,
          });
          if (!ok) return;
          const row = wd.closest('.ledger__row');
          row.style.height = row.offsetHeight + 'px';
          void row.offsetHeight;
          row.classList.add('is-gone');
          await sleep(HT.reduced() ? 0 : 420);
          HT.api.remove(c.id);
          HT.toast(`已撤回《${c.title}》`);
          $('#meBody', page).innerHTML = createdHTML();
          refreshCounts();
        }
      });

      /* 在「我收藏的」里取消收藏：卡片当场退场 */
      const offFav = HT.bus.on('fav', async (p) => {
        if (tab() !== 'favorites' || p.favorited) { if (page.isConnected && tab() !== 'profile') refreshCounts(); return; }
        const card = $(`.cap[data-id="${p.id}"]`, page);
        if (card) { card.classList.add('is-gone'); await sleep(HT.reduced() ? 0 : 320); }
        if (!page.isConnected) return;
        $('#meBody', page).innerHTML = favoritesHTML();
        refreshCounts();
        HT.toast('已取消收藏');
      });

      const offTick = HT.tick.on((now) => {
        $$('[data-cd]', page).forEach((el) => { const at = +el.dataset.cd; if (at > now) el.innerHTML = HT.cdShort(at, now); });
        $$('[data-cd-plain]', page).forEach((el) => {
          const cd = fmt.cd(+el.dataset.cdPlain, now);
          if (cd.d === 0 && !cd.expired) el.innerHTML = `<span class="mono">${HT.pad2(cd.h)}:${HT.pad2(cd.m)}:${HT.pad2(cd.s)}</span>`;
        });
      });

      return () => { window.removeEventListener('resize', onResize); offFav(); offTick(); };
    },

    /* 在三个页签间切换时只换内容区，页头与页签不重绘——墨线滑过去 */
    update(page, ctx) {
      const tab = BODY[ctx.params.tab] ? ctx.params.tab : 'created';
      const body = $('#meBody', page);
      $$('.tabs__it', page).forEach((a) => { const on = a.dataset.tab === tab; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      placeInk(page, true);
      body.dataset.tab = tab;
      body.innerHTML = BODY[tab]();
      body.classList.remove('is-swap'); void body.offsetWidth; body.classList.add('is-swap');
      if (tab === 'profile') mountProfile(page);
    },
  };
})(window.HT);
