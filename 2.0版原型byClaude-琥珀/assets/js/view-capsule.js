/* ============================================================
   胶囊详情（/c/:code · /capsules/:code · /plaza/:id）与开启页（/open）
   详情是一台小状态机：封存中（进度环 + 翻牌倒计时）→ 开启中（抖动 · 迸光）→ 信笺
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, sleep } = HT;
  const RING_C = 2 * Math.PI * 150;

  function find(ctx) {
    return ctx.params.id ? HT.api.byId(ctx.params.id) : HT.api.byCode(ctx.params.code);
  }

  const backLink = (c) => `<a class="back" href="#/">${icon('arrow-left')}返回广场</a>`;

  function actions(c, letter) {
    return `<div class="detail__actions">
      ${HT.favBtn(c, 'md')}
      <button class="btn btn--ghost" type="button" data-copy-code>${icon('copy')}复制胶囊码</button>
      <button class="btn btn--ghost" type="button" data-copy-link>${icon('link')}分享链接</button>
      ${letter ? `<a class="btn btn--primary" href="#/create">${icon('pen')}我也写一枚</a>` : ''}
    </div>`;
  }

  /* ---------- 封存中 ---------- */
  function lockedHTML(c) {
    const now = Date.now();
    const pct = Math.min(100, Math.max(0, (now - c.createdAt) / (c.openAt - c.createdAt) * 100));
    return `${backLink(c)}
      <section class="vault card" id="vault" style="--glow:${HT.palette(c.code).glow}">
        <div class="vault__dial">
          <svg class="vault__ring" viewBox="0 0 340 340" aria-hidden="true">
            <circle class="vault__track" cx="170" cy="170" r="150"/>
            <circle class="vault__arc" cx="170" cy="170" r="150" style="stroke-dasharray:${(RING_C * pct / 100).toFixed(1)} ${RING_C.toFixed(1)}"/>
          </svg>
          <div class="vault__art" id="vaultArt">${HT.capsuleArt(c.code, 'locked', 220)}</div>
          <div class="vault__pct"><b class="mono" id="pct">${pct.toFixed(2)}%</b><span>时间已经走过</span></div>
        </div>
        <div class="vault__info">
          <div class="badges">${HT.stateBadge(c)}${HT.visBadge(c)}</div>
          <h1 class="vault__title">${esc(c.title)}</h1>
          <div class="vault__by">${HT.avatar(c.creator.avatarId)}来自 <b>${esc(c.creator.nickname)}</b> · 封存于 ${fmt.cn(c.createdAt)}</div>
          <div class="vault__k">距离开启还有</div>
          <div id="cdHost">${HT.countdownHTML()}</div>
          <dl class="vault__meta">
            <div><dt>${icon('calendar')}开启时间</dt><dd class="mono" id="openAt">${fmt.dateTime(c.openAt).replace(/\./g, '-')}</dd></div>
            <div><dt>${icon('key')}胶囊码</dt><dd class="mono">${c.code}</dd></div>
            <div><dt>${icon('heart')}在等它的人</dt><dd class="mono">${fmt.num(c.favoriteCount)}</dd></div>
          </dl>
          <p class="tip">${icon('sparkle')}<span>不用刷新页面——倒计时归零的那一刻，它会自己打开。</span></p>
          ${actions(c)}
        </div>
      </section>
      <div class="proto">原型演示 · 不想等？<button class="proto__btn" type="button" data-ff>快进到开启时刻${icon('arrow')}</button></div>`;
  }

  /* ---------- 开启中 ---------- */
  function openingHTML(c) {
    return `<div class="opening" id="opening">
      <div class="opening__burst"></div>
      <div class="opening__capsule">${HT.capsuleArt(c.code, 'locked', 300)}</div>
      <p class="opening__text">时间到了，正在开启……</p>
    </div>`;
  }

  /* ---------- 已开启：一封航空信 ---------- */
  function letterHTML(c, reveal) {
    const paras = String(c.content || '').split(/\n{2,}/).map((p, i) => `<p style="--i:${i}">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return `${backLink(c)}
      <div class="letter-page${reveal ? ' is-reveal' : ''}">
        <article class="letter">
          <div class="letter__meta"><span class="mono">${c.code}</span><i></i>${HT.visBadge(c)}</div>
          <h1 class="letter__title">${esc(c.title)}</h1>
          <div class="letter__from">${HT.avatar(c.creator.avatarId)}${esc(c.creator.nickname)} 写于 ${fmt.cn(c.createdAt)}</div>
          <div class="letter__body">${paras}</div>
          <footer class="letter__foot">
            <div class="letter__span">
              <div>${icon('hourglass')}这封信在时间里沉睡了 <b>${fmt.span(c.openAt - c.createdAt)}</b></div>
              <span class="mono">${fmt.dateTime(c.createdAt).replace(/\./g, '-')} 封存 → ${fmt.dateTime(c.openAt).replace(/\./g, '-')} 开启</span>
            </div>
            <div class="letter__sign">${HT.stamp(c.openAt, '已开启')}<span>—— ${esc(c.creator.nickname)}</span></div>
          </footer>
        </article>
        ${actions(c, true)}
        ${c.inPlaza ? '' : `<p class="tip tip--quiet">${icon('lock')}<span>这枚胶囊没有发布到广场，只有持有胶囊码的人能读到它。</span></p>`}
      </div>`;
  }

  function missingHTML(ctx) {
    const code = ctx.params.code ? String(ctx.params.code).toUpperCase() : '';
    return `<div class="notice card">
      ${HT.capsuleArt('LOST0000', 'opened', 200, 'notice__art')}
      <div class="eyebrow">Not found</div>
      <h1 class="page-title">找不到这枚胶囊</h1>
      <p class="page-lead">${code ? `没有胶囊码为 <b class="mono">${esc(code)}</b> 的胶囊。` : '这枚胶囊不存在，或者没有发布到广场。'}也许是码抄错了一位，也许它已经被主人撤回。</p>
      <div class="notice__act"><a class="btn btn--primary" href="#/open">${icon('key')}重新输入胶囊码</a><a class="btn btn--ghost" href="#/">回到广场</a></div>
    </div>`;
  }

  HT.views = HT.views || {};
  HT.views.capsule = {
    title: '胶囊',
    render(ctx) {
      const c = find(ctx);
      const inner = !c ? missingHTML(ctx) : c.isOpened ? letterHTML(c) : lockedHTML(c);
      return `<div class="page page--detail"><div class="container detail" id="detail">${inner}</div></div>`;
    },

    mount(page, ctx) {
      const host = $('#detail', page);
      let c = find(ctx);
      if (!c) return;
      document.title = `${c.title} · HelloTime Pro`;
      let opening = false;

      function paint(now) {
        const cdRoot = $('.cd', host);
        if (!cdRoot) return null;
        const cd = HT.paintCountdown(cdRoot, c.openAt, now);
        const pct = Math.min(100, Math.max(0, (now - c.createdAt) / (c.openAt - c.createdAt) * 100));
        $('#pct', host).textContent = pct.toFixed(2) + '%';
        $('.vault__arc', host).style.strokeDasharray = `${(RING_C * pct / 100).toFixed(1)} ${RING_C.toFixed(1)}`;
        return cd;
      }

      /* 开启：胶囊抖动 → 两半分开、迸出一团光 → 信纸自上而下展开，邮戳「啪」地盖上 */
      async function playOpening() {
        if (opening) return;
        opening = true;
        if (!HT.reduced()) {
          host.innerHTML = openingHTML(c);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          await sleep(820);
          const op = $('#opening', host);
          op.classList.add('is-open');
          $('.cart', op).classList.replace('cart--locked', 'cart--opened');
          await sleep(1150);
        }
        c = find(ctx);
        host.innerHTML = letterHTML(c, true);
        HT.toast('胶囊已开启');
      }

      if (!c.isOpened) {
        paint(Date.now());
        const off = HT.tick.on((now) => {
          if (opening) return;
          const cd = paint(now);
          if (cd && cd.expired) { off(); playOpening(); }
        });
      }

      host.addEventListener('click', (e) => {
        if (e.target.closest('[data-copy-code]')) return HT.copy(c.code, `已复制胶囊码 ${c.code}`);
        if (e.target.closest('[data-copy-link]')) return HT.copy(location.origin + location.pathname + '#/c/' + c.code, '已复制分享链接');
        if (e.target.closest('[data-ff]')) {
          HT.api.fastForward(c.id, 3600);
          c = find(ctx);
          $('#openAt', host).textContent = fmt.dateTime(c.openAt).replace(/\./g, '-');
          paint(Date.now());
          e.target.closest('.proto').remove();
        }
      });
    },
  };

  /* ---------------- 开启页 ---------------- */
  function capsuleRow(c) {
    return `<li><a class="crow" href="#/c/${c.code}" style="--glow:${HT.palette(c.code).glow}">
      ${HT.capsuleArt(c.code, c.isOpened ? 'opened' : 'locked', 72)}
      <span class="crow__info"><b>${esc(c.title)}</b><span class="mono">${c.code}</span></span>
      ${c.isOpened ? HT.badge('opened', 'mail', '已开启') : HT.badge('locked', 'lock', HT.cdShort(c.openAt) + ' 后')}
      ${icon('chev-right', 'crow__go')}
    </a></li>`;
  }

  HT.views.open = {
    title: '开启胶囊',
    render() {
      const me = HT.state.user;
      const mine = me ? HT.api.mine().slice(0, 3) : [];
      const hot = HT.api.featured();
      const demo = ['GK25WIND', hot ? hot.code : 'SAMESONG', 'MEMO4ME1'].map((k) => HT.api.byCode(k)).filter(Boolean);
      return `<div class="page page--open"><div class="container open">
        <header class="page-head page-head--center">
          <div class="eyebrow">Open a capsule</div>
          <h1 class="page-title">开启胶囊</h1>
          <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
        </header>
        <form class="open__form card" id="openForm" novalidate>
          ${HT.codeInput('lg')}
          <div class="open__err" id="openErr" role="alert"></div>
          <button class="btn btn--primary btn--lg" type="submit" id="openGo">${icon('key')}开启胶囊</button>
          <p class="open__hint">胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。<br>没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/c/胶囊码</code>。</p>
        </form>
        ${mine.length ? `<section class="open__list"><header><h2>我封存过的胶囊</h2><a class="link-btn" href="#/me/created">全部${icon('arrow')}</a></header><ul>${mine.map(capsuleRow).join('')}</ul></section>` : ''}
        <section class="open__list open__list--proto"><header><h2>原型里可用的胶囊码</h2><span>点一下，会替你一位一位输进去</span></header>
          <ul>${demo.map((c) => `<li><button class="crow" type="button" data-demo="${c.code}" style="--glow:${HT.palette(c.code).glow}">${HT.capsuleArt(c.code, c.isOpened ? 'opened' : 'locked', 72)}<span class="crow__info"><b>${esc(c.title)}</b><span class="mono">${c.code}</span></span>${c.isOpened ? HT.badge('opened', 'mail', '已开启') : HT.badge('locked', 'lock', '封存中')}${c.inPlaza ? '' : HT.badge('private', 'lock', '未公开')}${icon('chev-right', 'crow__go')}</button></li>`).join('')}</ul>
        </section>
      </div></div>`;
    },

    mount(page) {
      const form = $('#openForm', page), err = $('#openErr', page), go = $('#openGo', page);
      let busy = false;
      const ci = HT.bindCodeInput($('[data-code-input]', form), {
        onChange: (v) => { err.textContent = ''; go.disabled = busy; },
        onComplete: (v) => submit(v),
      });
      async function submit(v) {
        if (busy) return;
        if ((v || '').length !== 8) { ci.error(); err.textContent = '还差 ' + (8 - (v || '').length) + ' 位'; ci.focus(); return; }
        busy = true; go.classList.add('is-busy'); ci.setState('checking');
        await sleep(700);
        busy = false; go.classList.remove('is-busy'); ci.setState('');
        const c = HT.api.byCode(v);
        if (!c) { ci.error(); err.textContent = '没有找到这枚胶囊。请核对胶囊码。'; ci.focus(); return; }
        ci.setState('ok');
        await sleep(320);
        HT.go('/c/' + c.code);
      }
      form.addEventListener('submit', (e) => { e.preventDefault(); submit(ci.value); });

      page.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-demo]');
        if (!b || busy) return;
        const code = b.dataset.demo;
        ci.set('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        for (let k = 1; k <= 8; k++) { ci.set(code.slice(0, k)); await sleep(70); }
        submit(code);
      });
      setTimeout(() => { if (page.isConnected) ci.focus(); }, 350);
    },
  };
})(window.HT);
