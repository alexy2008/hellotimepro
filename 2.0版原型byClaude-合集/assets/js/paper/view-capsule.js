/* ============================================================
   胶囊详情（/capsules/:code）与 开启页（/open）
   详情有三种形态：未启封（信封 + 倒计时）· 启封动画 · 已启封（信纸）
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, pad2, sleep } = HT;

  /* ---------------- 详情 ---------------- */

  function find(ctx) {
    return HT.api.byCode(ctx.params.code);
  }

  const visTag = (c) => c.inPlaza
    ? `<span class="tag">${icon('globe')}广场公开</span>`
    : `<span class="tag tag--quiet">${icon('lock')}仅凭码可见</span>`;

  function actions(c) {
    return `<div class="detail__actions">
      ${HT.favBtn(c, 'md')}
      <button class="btn btn--ghost" type="button" data-copy-code>${icon('copy')}复制胶囊码</button>
      <button class="btn btn--ghost" type="button" data-copy-link>${icon('link')}分享链接</button>
    </div>`;
  }

  function sealedHTML(c) {
    const now = Date.now();
    const unit = (k, lab) => `<div class="cd__unit"><span class="cd__num latin" data-u="${k}"></span><span class="cd__lab">${lab}</span></div>`;
    return `
      <a class="back" href="#/">${icon('arrow-left')}返回广场</a>
      <header class="detail__head">
        <div class="detail__meta"><span class="mono">NO. ${c.code}</span>${visTag(c)}<span class="tag tag--seal">${HT.seal('封', 'solid')}未开启</span></div>
        <h1 class="detail__title">${esc(c.title)}</h1>
        <div class="detail__by">${HT.avatar(c.creator.avatarId)}<b>${esc(c.creator.nickname)}</b><span>封存于 ${fmt.cn(c.createdAt)} ${fmt.time(c.createdAt)}</span></div>
      </header>

      <section class="stage" id="stage">
        <div class="stage__pm">${HT.postmark({ line1: fmt.date(c.openAt), line2: fmt.time(c.openAt) + ' 启', cls: 'pm--stage' })}</div>
        ${HT.envelope({ cls: 'env--stage', letter: `<b>${esc(c.title)}</b><i></i><i></i><i></i><i></i>` })}
        <div class="stage__floor"></div>
      </section>

      <section class="cd" id="cd" aria-live="off">
        <div class="cd__label" id="cdLabel">距离启封还有</div>
        <div class="cd__digits">
          ${unit('d', '天')}<i class="cd__sep">:</i>${unit('h', '时')}<i class="cd__sep">:</i>${unit('m', '分')}<i class="cd__sep">:</i>${unit('s', '秒')}
        </div>
        <div class="cd__when">将于 <b>${fmt.full(c.openAt)}</b> 启封</div>
      </section>

      <section class="journey">
        <div class="journey__row">
          <span><em>封存</em>${fmt.date(c.createdAt)}</span>
          <span class="journey__pct" id="pct">已等待 ${fmt.progress(c, now)}%</span>
          <span><em>启封</em>${fmt.date(c.openAt)}</span>
        </div>
        <div id="scaleHost">${HT.scale(fmt.progress(c, now), 'scale--lg')}</div>
      </section>

      ${actions(c)}
      <p class="note">${icon('info')}<span>未开启的胶囊只显示标题与倒计时。正文会在启封的那一刻，对所有持码的人同时公开。</span></p>
      <div class="proto">原型演示 · 不想等？<button class="proto__btn" type="button" data-ff>快进到启封时刻${icon('arrow')}</button></div>`;
  }

  function openedHTML(c, reveal) {
    const paras = String(c.content || '').split(/\n{2,}/).map((p, i) => `<p style="--i:${i}">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return `
      <a class="back" href="#/">${icon('arrow-left')}返回广场</a>
      <article class="letter${reveal ? ' letter--reveal' : ''}">
        <div class="letter__pm">${HT.postmark({ line1: fmt.date(c.openAt), line2: '已 启 封', cls: 'pm--letter' })}</div>
        <div class="letter__meta"><span class="mono">NO. ${c.code}</span>${visTag(c)}</div>
        <h1 class="letter__title">${esc(c.title)}</h1>
        <dl class="letter__facts">
          <div><dt>封存</dt><dd class="mono">${fmt.dateTime(c.createdAt)}</dd></div>
          <div><dt>启封</dt><dd class="mono">${fmt.dateTime(c.openAt)}</dd></div>
          <div><dt>在途</dt><dd>${fmt.span(c.openAt - c.createdAt)}</dd></div>
        </dl>
        <div class="letter__body">${paras}</div>
        <footer class="letter__sign">
          <div class="letter__from"><span>——</span>${HT.avatar(c.creator.avatarId)}<b>${esc(c.creator.nickname)}</b></div>
          <div class="letter__date">写于 ${fmt.cn(c.createdAt)}</div>
          ${HT.seal('启', 'line', 'letter__seal')}
        </footer>
      </article>
      ${actions(c)}
      ${c.inPlaza
        ? `<p class="note note--ok">${icon('check')}<span>这枚胶囊已在广场公开，任何人都可以通过广场或 8 位胶囊码读到它。</span></p>`
        : `<p class="note">${icon('lock')}<span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span></p>`}`;
  }

  function missingHTML(ctx) {
    const code = ctx.params.code ? String(ctx.params.code).toUpperCase() : '';
    return `<div class="lost">
      <div class="lost__mark">${HT.seal('无', 'line')}</div>
      <h1 class="h1">查无此信</h1>
      <p>${code ? `没有找到胶囊码为 <b class="mono">${esc(code)}</b> 的胶囊。` : '这枚胶囊不存在。'}<br>它也可能已经被作者删除了。</p>
      <div class="lost__act"><a class="btn btn--primary" href="#/open">${icon('key')}重新输入胶囊码</a><a class="btn btn--ghost" href="#/">回到广场</a></div>
    </div>`;
  }

  const V = HT.skin('paper').views;
  V.capsule = {
    title: '胶囊',
    render(ctx) {
      const c = find(ctx);
      const inner = !c ? missingHTML(ctx) : c.isOpened ? openedHTML(c) : sealedHTML(c);
      return `<div class="page page--detail"><div class="wrap wrap--narrow detail" id="detail">${inner}</div></div>`;
    },

    mount(page, ctx) {
      const host = $('#detail', page);
      let c = find(ctx);
      if (!c) return;
      document.title = `${c.title} · HelloTime Pro`;
      let opening = false;
      let last = {};

      function paintDigits(now) {
        const cd = fmt.cd(c.openAt, now);
        const vals = { d: cd.d > 99 ? String(cd.d) : pad2(cd.d), h: pad2(cd.h), m: pad2(cd.m), s: pad2(cd.s) };
        Object.keys(vals).forEach((k) => {
          const el = $(`[data-u="${k}"]`, host);
          if (el && last[k] !== vals[k]) { HT.setDigits(el, vals[k]); last[k] = vals[k]; }
        });
        const p = fmt.progress(c, now);
        const pct = $('#pct', host);
        if (pct) pct.textContent = `已等待 ${p}%`;
        const sc = $('.scale', host);
        if (sc) sc.style.setProperty('--p', p + '%');
        return cd;
      }

      /* 启封：火漆裂开 → 封舌掀起露出朱红内衬 → 信纸升起 → 换成信纸页，字迹逐段显影 */
      async function playOpening() {
        if (opening) return;
        opening = true;
        const stage = $('#stage', host);
        const env = $('.env', stage);
        const sealBox = $('.env__seal', env);
        $('#cdLabel', host).textContent = '时间到了，正在启封…';
        host.classList.add('is-opening');
        if (!HT.reduced()) {
          const wax = sealBox.innerHTML;
          sealBox.innerHTML = `<span class="wax-half wax-half--l">${wax}</span><span class="wax-half wax-half--r">${wax}</span>`;
          await sleep(60);
          sealBox.classList.add('is-cracked');
          await sleep(620);
          env.classList.add('is-open');
          await sleep(760);
          env.classList.add('is-rising');
          await sleep(900);
          host.classList.add('is-leaving');
          await sleep(380);
        }
        c = find(ctx);
        host.classList.remove('is-opening', 'is-leaving');
        host.innerHTML = openedHTML(c, true);
        window.scrollTo({ top: 0, behavior: HT.reduced() ? 'auto' : 'smooth' });
        HT.toast('胶囊已启封');
      }

      if (!c.isOpened) {
        paintDigits(Date.now());
        const off = HT.tick.on((now) => {
          if (opening || !$('#cd', host)) return;
          const cd = paintDigits(now);
          if (cd.expired) { off(); playOpening(); }
        });
      }

      host.addEventListener('click', (e) => {
        if (e.target.closest('[data-copy-code]')) return HT.copy(c.code, `已复制胶囊码 ${c.code}`);
        if (e.target.closest('[data-copy-link]')) return HT.copy(location.origin + location.pathname + '#/capsules/' + c.code, '已复制分享链接');
        if (e.target.closest('[data-ff]')) {
          HT.api.fastForward(c.id, 3600);
          c = find(ctx);
          last = {};
          paintDigits(Date.now());
          $('.cd__when', host).innerHTML = `将于 <b>${fmt.full(c.openAt)}</b> 启封`;
          e.target.closest('.proto').remove();
        }
      });
    },
  };

  /* ---------------- 开启页 ---------------- */

  function demoCodes() {
    const hot = HT.api.featured();
    const pick = ['GK25WIND', hot ? hot.code : 'SAMESONG', 'MEMO4ME1'];
    return pick.map((code) => {
      const c = HT.api.byCode(code);
      if (!c) return '';
      const label = (c.isOpened ? '已开启' : '未开启') + (c.inPlaza ? '' : ' · 未公开');
      return `<button class="chip chip--code" type="button" data-demo="${code}"><span class="mono">${code}</span><small>${label}</small></button>`;
    }).join('');
  }

  V.open = {
    title: '开启胶囊',
    render() {
      const me = HT.state.user;
      const mine = me ? HT.api.mine().slice(0, 3) : [];
      const row = (c) => `<li><a class="mylist__row" href="#/capsules/${c.code}">${HT.seal(c.isOpened ? '启' : '封', c.isOpened ? 'line' : 'solid')}<span class="mylist__info"><b class="serif">${esc(c.title)}</b><span class="mono">${c.code}</span></span><span class="mylist__st">${c.isOpened ? '已开启' : '距启封 ' + fmt.span(c.openAt - Date.now())}</span>${icon('chev-right')}</a></li>`;
      const cell = (i) => `<input class="code__cell mono" type="text" inputmode="text" maxlength="1" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="第 ${i + 1} 位" data-i="${i}" style="--k:${i}">`;
      return `<div class="page page--open">
        <div class="wrap openp">
          <div class="openp__poem" aria-hidden="true"><span>云中谁寄锦书来</span><i></i><small>李清照 ·《一剪梅》</small></div>
          <section class="openp__main">
            <div class="overline"><i></i>Open a capsule</div>
            <h1 class="h1">凭码开启</h1>
            <p class="lede">输入朋友分享给你的 8 位胶囊码。<br>如果还没到启封的时刻，你会看到它的倒计时。</p>

            <div class="code" id="code" role="group" aria-label="8 位胶囊码">
              ${[0, 1, 2, 3].map(cell).join('')}<span class="code__dash" aria-hidden="true"></span>${[4, 5, 6, 7].map(cell).join('')}
            </div>
            <div class="openp__err" id="err" role="alert"></div>

            <div class="openp__act">
              <button class="btn btn--primary btn--lg" type="button" id="go" disabled>${icon('key')}<span>开启</span>${icon('arrow', 'ic--go')}</button>
              <button class="btn btn--ghost btn--lg" type="button" id="paste">${icon('paste')}粘贴识别</button>
            </div>

            <ul class="openp__tips">
              <li>${icon('link')}<span>也可以直接访问 <code class="mono">/c/&lt;胶囊码&gt;</code></span></li>
              <li>${icon('lock')}<span>没有发布到广场的胶囊，同样可以凭码开启</span></li>
            </ul>

            ${mine.length ? `<section class="mylist"><header><h2 class="serif">我封存过的胶囊</h2><a class="link" href="#/me/created">全部${icon('arrow')}</a></header><ul>${mine.map(row).join('')}</ul></section>` : ''}

            <div class="proto proto--left">原型里可用的胶囊码 ·<span class="proto__chips">${demoCodes()}</span></div>
          </section>
        </div>
      </div>`;
    },

    mount(page) {
      const cells = $$('.code__cell', page);
      const box = $('#code', page);
      const err = $('#err', page);
      const go = $('#go', page);
      let busy = false;

      const value = () => cells.map((c) => c.value).join('');
      const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      function sync() {
        cells.forEach((c) => c.classList.toggle('is-filled', !!c.value));
        go.disabled = value().length !== 8 || busy;
        err.textContent = '';
        box.classList.remove('is-error');
      }
      function fill(str, from) {
        const s = clean(str).slice(0, 8 - (from || 0));
        Array.from(s).forEach((ch, k) => { cells[(from || 0) + k].value = ch; });
        sync();
        const next = Math.min(7, (from || 0) + s.length);
        cells[next].focus();
      }

      async function submit() {
        if (busy) return;
        const code = value();
        if (code.length !== 8) {
          HT.shake(box);
          (cells.find((c) => !c.value) || cells[0]).focus();
          return;
        }
        busy = true; sync();
        box.classList.add('is-checking');
        go.classList.add('is-busy');
        await sleep(720);
        const c = HT.api.byCode(code);
        box.classList.remove('is-checking');
        go.classList.remove('is-busy');
        busy = false;
        if (!c) {
          sync();
          box.classList.add('is-error');
          HT.shake(box);
          err.textContent = '没有找到这枚胶囊。请核对胶囊码——留意字母 O 与数字 0、字母 I 与数字 1。';
          cells[7].focus();
          return;
        }
        box.classList.add('is-ok');
        await sleep(360);
        HT.go('/capsules/' + c.code);
      }

      cells.forEach((cell, i) => {
        cell.addEventListener('input', (e) => {
          if (e.isComposing) return;
          const v = clean(cell.value);
          cell.value = v.slice(-1);
          sync();
          if (cell.value && i < 7) cells[i + 1].focus();
          if (value().length === 8 && i === 7) submit();
        });
        cell.addEventListener('compositionend', () => { cell.value = clean(cell.value).slice(-1); sync(); if (cell.value && i < 7) cells[i + 1].focus(); });
        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !cell.value && i > 0) { e.preventDefault(); cells[i - 1].value = ''; cells[i - 1].focus(); sync(); }
          else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); cells[i - 1].focus(); }
          else if (e.key === 'ArrowRight' && i < 7) { e.preventDefault(); cells[i + 1].focus(); }
          else if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });
        cell.addEventListener('focus', () => cell.select());
        cell.addEventListener('paste', (e) => {
          e.preventDefault();
          const t = clean((e.clipboardData || window.clipboardData).getData('text'));
          if (!t) return;
          fill(t, t.length >= 8 ? 0 : i);
          if (value().length === 8) submit();
        });
      });

      go.addEventListener('click', submit);
      $('#paste', page).addEventListener('click', async () => {
        try {
          const t = clean(await navigator.clipboard.readText());
          if (!t) return HT.toast('剪贴板里没有胶囊码', { type: 'info' });
          cells.forEach((c) => { c.value = ''; });
          fill(t, 0);
          if (value().length === 8) submit();
        } catch (e) { HT.toast('粘贴失败：请允许浏览器访问剪贴板', { type: 'err' }); }
      });

      /* 演示码：一位一位敲进去，再自动提交 */
      page.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-demo]');
        if (!b || busy) return;
        cells.forEach((c) => { c.value = ''; });
        sync();
        const code = b.dataset.demo;
        for (let k = 0; k < 8; k++) { cells[k].value = code[k]; cells[k].classList.add('is-filled'); await sleep(55); }
        sync();
        submit();
      });

      setTimeout(() => cells[0].focus({ preventScroll: true }), 350);
    },
  };
})(window.HT);
