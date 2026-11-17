/* ============================================================
   登录（/login）· 注册（/register）· 我的（/me/created · /me/favorites · /me/profile）
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, sleep } = HT;

  /* ---------------- 表单小件 ---------------- */
  const field = ({ id, label, type, hint, attrs, value, trail, req, lead }) => `
    <div class="field" data-field="${id}">
      <div class="field__head"><label class="field__label" for="${id}">${label}${req ? ' <em>*</em>' : ''}</label></div>
      <div class="input-wrap${lead ? ' input-wrap--icon' : ''}${trail ? ' input-wrap--action' : ''}">
        ${lead ? icon(lead, 'input-wrap__icon') : ''}
        <input class="input" id="${id}" name="${id}" type="${type || 'text'}" value="${esc(value || '')}" ${attrs || ''} aria-describedby="${id}-hint">
        ${trail || ''}
      </div>
      <div class="field__hint" id="${id}-hint" data-hint="${esc(hint || '')}">${hint || ''}</div>
    </div>`;
  const eye = `<button class="input-wrap__action icon-btn" type="button" data-eye aria-label="显示密码">${icon('eye')}</button>`;
  const nickState = '<span class="input-wrap__action nick-state" data-nick-state aria-hidden="true"></span>';

  function setErr(root, id, msg) {
    const f = $(`[data-field="${id}"]`, root);
    if (!f) return;
    const h = $('.field__hint', f);
    f.classList.toggle('is-error', !!msg);
    f.classList.remove('is-ok');
    h.textContent = msg || h.dataset.hint;
    if (msg) HT.shake($('.input-wrap', f));
  }
  function setOk(root, id, msg) {
    const f = $(`[data-field="${id}"]`, root);
    if (!f) return;
    f.classList.remove('is-error'); f.classList.add('is-ok');
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
  function bindRules(root, id) {
    const inp = $('#' + id, root), list = $(`[data-rules="${id}"]`, root);
    const paint = () => { const r = pwdOk(inp.value); $$('[data-rule]', list).forEach((li) => li.classList.toggle('is-ok', r[li.dataset.rule])); };
    inp.addEventListener('input', paint); paint();
  }

  /* 头像：十颗小星球，选中的那颗套上琥珀光环 */
  function avatarPicker(sel) {
    const cur = HT.avatarOf(sel);
    return `<div class="avpick" role="radiogroup" aria-label="选择头像" data-avpick>
        ${HT.AVATARS.map((a) => `<button type="button" class="avpick__it${a.id === sel ? ' is-sel' : ''}" role="radio" aria-checked="${a.id === sel}" tabindex="${a.id === sel ? 0 : -1}" data-av="${a.id}" aria-label="${a.name}，${a.tagline}">${HT.avatar(a.id, 'av--xl')}<span>${a.name}</span></button>`).join('')}
      </div>
      <div class="avpick__cap" data-avcap>${HT.avatar(cur.id)}<b>${cur.name}</b><span>${cur.tagline}</span></div>`;
  }
  function bindAvatarPicker(root, onPick) {
    const box = $('[data-avpick]', root);
    const pick = (id, focus) => {
      $$('.avpick__it', box).forEach((b) => {
        const on = b.dataset.av === id;
        b.classList.toggle('is-sel', on); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      const a = HT.avatarOf(id);
      $('[data-avcap]', root).innerHTML = `${HT.avatar(a.id)}<b>${a.name}</b><span>${a.tagline}</span>`;
      onPick(id);
    };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-av]'); if (b) pick(b.dataset.av); });
    box.addEventListener('keydown', (e) => {
      const ids = HT.AVATARS.map((a) => a.id);
      const i = ids.indexOf($('.avpick__it.is-sel', box).dataset.av);
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % ids.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + ids.length) % ids.length;
      if (n == null) return;
      e.preventDefault(); pick(ids[n], true);
    });
    return { pick };
  }

  /* 昵称：格式校验 + 模拟唯一性异步检查 */
  function bindNickname(root, id, exceptId) {
    const inp = $('#' + id, root), st = $('[data-nick-state]', root);
    let timer = 0, seq = 0;
    inp.addEventListener('input', () => {
      const v = inp.value.trim();
      clearTimeout(timer);
      const my = ++seq;
      st.className = 'input-wrap__action nick-state'; st.innerHTML = '';
      const hint = $(`[data-field="${id}"] .field__hint`, root);
      setErr(root, id, '');
      if (!v) return;
      if (Array.from(v).length < 2) { hint.textContent = '至少 2 个字符'; return; }
      if (!/^[一-龥A-Za-z0-9_-]{2,20}$/.test(v)) { setErr(root, id, '只能用中英文、数字、下划线和连字符'); return; }
      hint.textContent = '正在检查昵称是否可用…';
      st.classList.add('is-busy');
      timer = setTimeout(() => {
        if (my !== seq) return;
        st.classList.remove('is-busy');
        if (HT.api.nicknameTaken(v, exceptId)) { st.classList.add('is-bad'); st.innerHTML = icon('x'); setErr(root, id, `「${v}」已经有人用了，换一个吧`); }
        else { st.classList.add('is-good'); st.innerHTML = icon('check'); setOk(root, id, '这个昵称可以用'); }
      }, 520);
    });
  }

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  async function busyBtn(btn, label, ms) {
    btn.disabled = true; btn.classList.add('is-busy');
    const span = $('span', btn), old = span.textContent;
    span.textContent = label;
    await sleep(ms || 640);
    return () => { btn.disabled = false; btn.classList.remove('is-busy'); span.textContent = old; };
  }

  /* 登录 / 注册卡片顶上的小景：一枚在轨道上缓缓转动的胶囊 */
  const authArt = (state) => `<div class="auth__art" aria-hidden="true"><span class="auth__orbit"></span><span class="auth__orbit auth__orbit--2"></span>${HT.capsuleArt(null, state, 180)}</div>`;

  const V = HT.skin('amber').views;

  /* ---------------- 登录 ---------------- */
  V.login = {
    title: '登录',
    guest: true,
    render(ctx) {
      const rd = ctx.query.redirect ? '?redirect=' + encodeURIComponent(ctx.query.redirect) : '';
      return `<div class="page page--auth"><div class="container auth">
        <div class="auth__card card">
          ${authArt('locked')}
          <div class="eyebrow eyebrow--center">Welcome back</div>
          <h1 class="page-title">欢迎回来</h1>
          <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
          ${ctx.query.redirect ? `<p class="tip">${icon('info')}<span>登录后会带你回到刚才的页面。</span></p>` : ''}
          <form id="form" novalidate>
            ${field({ id: 'email', label: '邮箱', type: 'email', lead: 'mail', attrs: 'autocomplete="email" placeholder="you@example.com" required' })}
            ${field({ id: 'password', label: '密码', type: 'password', lead: 'lock', attrs: 'autocomplete="current-password" placeholder="输入密码" required', trail: eye, hint: '忘记密码？当前版本暂不支持找回。' })}
            <div class="form__err" id="formErr" role="alert"></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit"><span>登录</span>${icon('arrow')}</button>
          </form>
          <p class="auth__alt">还没有账号？<a href="#/register${rd}">注册一个</a></p>
          <div class="proto">原型演示 ·<button class="proto__btn" type="button" data-demo>填入演示账号「阿青」${icon('arrow')}</button></div>
        </div>
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
        } catch (ex) { done(); err.textContent = ex.message; HT.shake(form); }
      });
      setTimeout(() => { if (page.isConnected) $('#email', page).focus({ preventScroll: true }); }, 380);
    },
  };

  /* ---------------- 注册 ---------------- */
  V.register = {
    title: '注册',
    guest: true,
    render(ctx) {
      const rd = ctx.query.redirect ? '?redirect=' + encodeURIComponent(ctx.query.redirect) : '';
      return `<div class="page page--auth"><div class="container auth">
        <div class="auth__card auth__card--wide card">
          ${authArt('opened')}
          <div class="eyebrow eyebrow--center">Create account</div>
          <h1 class="page-title">领一个身份</h1>
          <p class="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>
          <form id="form" novalidate>
            <div class="form__row">
              ${field({ id: 'email', label: '邮箱', type: 'email', lead: 'mail', req: true, attrs: 'autocomplete="email" placeholder="you@example.com" required', hint: '作为登录账号，注册后不可修改。' })}
              ${field({ id: 'nickname', label: '昵称', lead: 'user', req: true, attrs: 'maxlength="20" autocomplete="nickname" placeholder="2–20 个字符" required', hint: '全站唯一，注册后可以改。', trail: nickState })}
            </div>
            ${field({ id: 'password', label: '密码', type: 'password', lead: 'lock', req: true, attrs: 'autocomplete="new-password" placeholder="设置密码" required', trail: eye })}
            ${rules('password')}
            <div class="field field--plain"><div class="field__head"><span class="field__label">头像 <em>*</em></span><span class="field__count">十选一，不支持上传</span></div>${avatarPicker('neo')}</div>
            <div class="form__err" id="formErr" role="alert"></div>
            <button class="btn btn--primary btn--lg btn--block" type="submit"><span>创建账号，开始写胶囊</span>${icon('arrow')}</button>
          </form>
          <p class="auth__alt">已经有账号？<a href="#/login${rd}">去登录</a></p>
        </div>
      </div></div>`;
    },
    mount(page, ctx) {
      const form = $('#form', page), err = $('#formErr', page);
      let avatarId = 'neo';
      bindEyes(page);
      bindRules(page, 'password');
      bindAvatarPicker(page, (id) => { avatarId = id; });
      bindNickname(page, 'nickname');
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
          HT.toast(`你好，${u.nickname}`);
          HT.go(ctx.query.redirect || '/create');
        } catch (ex) { done(); if (ex.field) setErr(page, ex.field, ex.message); else err.textContent = ex.message; }
      });
      setTimeout(() => { if (page.isConnected) $('#email', page).focus({ preventScroll: true }); }, 380);
    },
  };

  /* ---------------- 我的 ---------------- */
  function meHead() {
    const me = HT.state.user;
    const mine = HT.api.mine();
    const waiting = mine.filter((c) => !c.isOpened).length;
    const loved = mine.reduce((n, c) => n + c.favoriteCount, 0);
    return `<header class="me__head card">
      <div class="me__id">
        <div class="me__orb">${HT.avatar(me.avatarId, 'av--hero')}<span class="me__ring"></span></div>
        <div>
          <div class="eyebrow">My capsules</div>
          <h1 class="page-title">${esc(me.nickname)}</h1>
          <p class="me__mail"><span class="mono">${esc(me.email)}</span><span>${fmt.cn(me.createdAt)} 加入</span></p>
        </div>
      </div>
      <dl class="me__stats">
        <div><dd class="mono">${mine.length}</dd><dt>写下的胶囊</dt></div>
        <div><dd class="mono">${waiting}</dd><dt>还在封存中</dt></div>
        <div><dd class="mono">${fmt.num(loved)}</dd><dt>被收藏的次数</dt></div>
      </dl>
    </header>`;
  }

  function meTabs(tab) {
    const it = (key, label, ic, n) => `<a class="seg__opt${tab === key ? ' is-active' : ''}" href="#/me/${key}" data-tab="${key}"${tab === key ? ' aria-current="page"' : ''}>${icon(ic)}${label}${n != null ? `<sup>${n}</sup>` : ''}</a>`;
    return `<div class="me__bar">
      <nav class="seg seg--lg" id="meTabs" aria-label="我的"><span class="seg__thumb"></span>
        ${it('created', '我创建的', 'feather', HT.api.mine().length)}${it('favorites', '我收藏的', 'heart', HT.api.favorites().length)}${it('profile', '账号设置', 'sliders')}
      </nav>
      <button class="btn btn--ghost btn--sm" type="button" data-logout>${icon('logout')}登出</button>
    </div>`;
  }

  function createdHTML() {
    const list = HT.api.mine();
    if (!list.length) return `<div class="empty">${HT.capsuleArt(null, 'opened', 170, 'empty__art')}<h3 class="empty__title">还没有写下任何胶囊</h3><p>第一枚，写给一年后的自己怎么样？</p><a class="btn btn--primary" href="#/create">${icon('pen')}写一枚胶囊</a></div>`;
    const now = Date.now();
    return `<div class="me__sub"><span>按创建时间倒序 · 共 ${list.length} 枚</span><a class="btn btn--primary btn--sm" href="#/create">${icon('plus')}写一枚</a></div>
      <ul class="ledger">
        ${list.map((c, i) => `<li class="ledger__row" data-id="${c.id}" style="--i:${i};--glow:${HT.palette(c.code).glow}">
          <a class="ledger__art" href="#/capsules/${c.code}" tabindex="-1" aria-hidden="true">${HT.capsuleArt(c.code, c.isOpened ? 'opened' : 'locked', 112)}</a>
          <div class="ledger__main">
            <a class="ledger__title" href="#/capsules/${c.code}">${esc(c.title)}</a>
            <div class="ledger__sub">
              <button class="ledger__code mono" type="button" data-copy="${c.code}" title="点击复制胶囊码">${c.code}${icon('copy')}</button>
              ${HT.visBadge(c)}<span>封存于 ${fmt.date(c.createdAt)}</span>
            </div>
          </div>
          <div class="ledger__when">${c.isOpened
            ? `${HT.badge('opened', 'mail', '已开启')}<span>${fmt.date(c.openAt)} · 沉睡 ${fmt.span(c.openAt - c.createdAt)}</span>`
            : `<span class="ledger__cd">${icon('hourglass')}<b class="mono" data-cd="${c.openAt}">${HT.cdShort(c.openAt, now)}</b></span><div class="pc__progress"><span style="width:${Math.max(2, fmt.progress(c, now))}%"></span></div>`}</div>
          <div class="ledger__fav" title="被收藏 ${c.favoriteCount} 次">${icon('heart')}<span class="mono">${fmt.num(c.favoriteCount)}</span></div>
          <div class="ledger__act">
            <a class="btn btn--ghost btn--sm" href="#/capsules/${c.code}">查看</a>
            <button class="btn btn--danger-ghost btn--sm" type="button" data-delete="${c.id}">删除</button>
          </div>
        </li>`).join('')}
      </ul>
      <p class="tip tip--quiet">${icon('info')}<span>胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。</span></p>`;
  }

  function favoritesHTML() {
    const list = HT.api.favorites();
    if (!list.length) return `<div class="empty">${HT.capsuleArt(null, 'locked', 170, 'empty__art')}<h3 class="empty__title">还没有收藏</h3><p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p><a class="btn btn--primary" href="#/">去广场逛逛${icon('arrow')}</a></div>`;
    return `<div class="me__sub"><span>按收藏时间倒序 · 共 ${list.length} 枚</span><a class="btn btn--ghost btn--sm" href="#/">去广场逛逛</a></div>
      <div class="grid">${list.map((c, i) => HT.card(c, { i })).join('')}</div>`;
  }

  function profileHTML() {
    const me = HT.state.user;
    return `<div class="profile">
      <section class="card card--pad">
        <div class="eyebrow">Profile</div><h2 class="card__title">基本信息</h2>
        <form id="profileForm" novalidate>
          ${field({ id: 'p-email', label: '邮箱', type: 'email', lead: 'mail', value: me.email, attrs: 'disabled', hint: '邮箱是登录账号，不可修改。' })}
          ${field({ id: 'p-nick', label: '昵称', lead: 'user', value: me.nickname, attrs: 'maxlength="20" autocomplete="nickname"', hint: '2–20 个字符，全站唯一。', trail: nickState })}
          <div class="field field--plain"><div class="field__head"><span class="field__label">头像</span></div>${avatarPicker(me.avatarId)}</div>
          <div class="form__msg" id="profileMsg" role="status"></div>
          <div class="card__act"><button class="btn btn--ghost" type="button" data-reset>重置</button><button class="btn btn--primary" type="submit"><span>保存更改</span></button></div>
        </form>
      </section>
      <section class="card card--pad">
        <div class="eyebrow">Security</div><h2 class="card__title">修改密码</h2>
        <form id="pwdForm" novalidate>
          ${field({ id: 'pw-cur', label: '当前密码', type: 'password', lead: 'lock', attrs: 'autocomplete="current-password"', trail: eye })}
          ${field({ id: 'pw-new', label: '新密码', type: 'password', lead: 'key', attrs: 'autocomplete="new-password"', trail: eye })}
          ${rules('pw-new')}
          ${field({ id: 'pw-again', label: '再输一次新密码', type: 'password', lead: 'key', attrs: 'autocomplete="new-password"', trail: eye })}
          <div class="form__msg" id="pwdMsg" role="status"></div>
          <p class="tip tip--quiet">${icon('shield')}<span>修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。</span></p>
          <div class="card__act"><button class="btn btn--primary" type="submit"><span>更新密码</span></button></div>
        </form>
      </section>
    </div>`;
  }

  const BODY = { created: createdHTML, favorites: favoritesHTML, profile: profileHTML };
  let segApi = null;

  function mountProfile(page) {
    const me = HT.state.user;
    let avatarId = me.avatarId;
    const picker = bindAvatarPicker(page, (id) => { avatarId = id; });
    bindNickname(page, 'p-nick', me.id);
    bindRules(page, 'pw-new');
    const msg = (id, type, text) => { const el = $('#' + id, page); el.className = 'form__msg' + (type ? ' is-' + type : ''); el.innerHTML = text ? `${icon(type === 'err' ? 'alert' : type === 'ok' ? 'check' : 'info')}<span>${text}</span>` : ''; };

    $('#profileForm', page).addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = HT.state.user, nickname = $('#p-nick', page).value.trim(), patch = {};
      if (nickname !== cur.nickname) patch.nickname = nickname;
      if (avatarId !== cur.avatarId) patch.avatarId = avatarId;
      if (!Object.keys(patch).length) return msg('profileMsg', 'info', '没有改动');
      if (patch.nickname != null && !/^[一-龥A-Za-z0-9_-]{2,20}$/.test(nickname)) return setErr(page, 'p-nick', '昵称需为 2–20 个字符：中英文、数字、下划线或连字符');
      const done = await busyBtn($('#profileForm button[type="submit"]', page), '保存中…', 520);
      try {
        HT.api.updateProfile(patch);
        done(); msg('profileMsg', 'ok', '已保存'); HT.toast('资料已更新');
        $('.me__head', page).outerHTML = meHead();
      } catch (ex) { done(); if (ex.field === 'nickname') setErr(page, 'p-nick', ex.message); else msg('profileMsg', 'err', ex.message); }
    });
    $('[data-reset]', page).addEventListener('click', () => {
      const cur = HT.state.user;
      $('#p-nick', page).value = cur.nickname;
      setErr(page, 'p-nick', '');
      $('[data-nick-state]', page).className = 'input-wrap__action nick-state';
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

  V.me = {
    title: '我的',
    auth: true,
    render(ctx) {
      const tab = BODY[ctx.params.tab] ? ctx.params.tab : 'created';
      return `<div class="page page--me"><div class="container me">
        ${meHead()}
        ${meTabs(tab)}
        <div class="me__body" id="meBody" data-tab="${tab}">${BODY[tab]()}</div>
      </div></div>`;
    },

    mount(page) {
      const tab = () => $('#meBody', page).dataset.tab;
      bindEyes(page);
      segApi = HT.seg($('#meTabs', page), () => {});
      const onResize = () => segApi.place(false);
      window.addEventListener('resize', onResize);
      if (tab() === 'profile') mountProfile(page);

      const refreshCounts = () => {
        $('.me__head', page).outerHTML = meHead();
        $('#meTabs', page).closest('.me__bar').outerHTML = meTabs(tab());
        segApi = HT.seg($('#meTabs', page), () => {});
      };

      page.addEventListener('click', async (e) => {
        const cp = e.target.closest('[data-copy]');
        if (cp) return HT.copy(cp.dataset.copy, `已复制胶囊码 ${cp.dataset.copy}`);
        if (e.target.closest('[data-logout]')) { HT.api.logout(); HT.toast('已登出'); return HT.go('/'); }
        const wd = e.target.closest('[data-delete]');
        if (wd) {
          const c = HT.api.byId(wd.dataset.delete, true);
          const ok = await HT.dialog({
            title: '删除这枚胶囊？',
            body: `<p>《${esc(c.title)}》会被永久删除。持有胶囊码 <b class="mono">${c.code}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。</p><p class="dlg__warn">${icon('alert')}此操作不可恢复。</p>`,
            confirm: '删除', cancel: '再想想', tone: 'danger',
            mark: `<div class="dlg__art">${HT.capsuleArt(c.code, 'opened', 120)}</div>`,
          });
          if (!ok) return;
          const row = wd.closest('.ledger__row');
          row.style.height = row.offsetHeight + 'px';
          void row.offsetHeight;
          row.classList.add('is-gone');
          await sleep(HT.reduced() ? 0 : 460);
          HT.api.remove(c.id);
          HT.toast(`已删除《${c.title}》`);
          $('#meBody', page).innerHTML = createdHTML();
          refreshCounts();
        }
      });

      const offFav = HT.bus.on('fav', async (p) => {
        if (tab() !== 'favorites' || p.favorited) { if (page.isConnected && tab() !== 'profile') refreshCounts(); return; }
        const card = $(`.pc[data-id="${p.id}"]`, page);
        if (card) { card.classList.add('is-gone'); await sleep(HT.reduced() ? 0 : 340); }
        if (!page.isConnected) return;
        $('#meBody', page).innerHTML = favoritesHTML();
        refreshCounts();
        HT.toast('已取消收藏');
      });

      const offTick = HT.tick.on((now) => {
        $$('[data-cd]', page).forEach((el) => { const at = +el.dataset.cd; if (at > now) el.textContent = HT.cdShort(at, now); });
      });

      return () => { window.removeEventListener('resize', onResize); offFav(); offTick(); };
    },

    /* 页签之间只换内容区，滑块滑过去 */
    update(page, ctx) {
      const tab = BODY[ctx.params.tab] ? ctx.params.tab : 'created';
      const body = $('#meBody', page);
      $$('#meTabs .seg__opt', page).forEach((a) => { const on = a.dataset.tab === tab; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      if (segApi) segApi.place(true);
      body.dataset.tab = tab;
      body.innerHTML = BODY[tab]();
      body.classList.remove('is-swap'); void body.offsetWidth; body.classList.add('is-swap');
      if (tab === 'profile') mountProfile(page);
    },
  };
})(window.HT);
