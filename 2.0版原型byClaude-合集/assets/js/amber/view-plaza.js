/* ============================================================
   首页 = 主视觉 + 胶囊广场（/）
   主视觉：「把此刻，寄给未来。」+ 两个主入口 + 就地输码开启 + 时间表盘
   广场：搜索 · 封存/开启筛选 · 最新/最热排序 · 卡片网格 · 分页
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;

  /* 查询条件放在模块级：从详情页返回时，广场停在原来的位置 */
  const Q = HT.plazaQ;   // 两套皮肤共用：切换后筛选、搜索、页码都还在

  /* 四角星芒 */
  function sparkle(cx, cy, r) {
    const k = r * 0.14;
    return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
  }

  /* 主视觉：一枚悬浮在「时间表盘」中央的胶囊。三层圆环反向旋转，年份环缓缓流过 */
  function heroArt() {
    const y0 = new Date().getFullYear();
    const years = Array.from({ length: 21 }, (_, i) => y0 + i).join(' · ') + ' · ';
    return `<div class="hart" id="hart" aria-hidden="true"><svg class="hart__svg" viewBox="0 0 600 600">
      <defs>
        <radialGradient id="hHalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".4"/><stop offset=".55" stop-color="#8f7dff" stop-opacity=".12"/><stop offset="1" stop-color="#8f7dff" stop-opacity="0"/></radialGradient>
        <linearGradient id="hMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2c2"/><stop offset=".22" stop-color="#ffc65c"/><stop offset=".6" stop-color="#f6902c"/><stop offset=".86" stop-color="#d9641a"/><stop offset="1" stop-color="#ffb45a"/></linearGradient>
        <linearGradient id="hSeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4ec2"/><stop offset=".3" stop-color="#2c2674"/><stop offset="1" stop-color="#120f38"/></linearGradient>
        <radialGradient id="hCore" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3c9" stop-opacity=".95"/><stop offset=".38" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a45" stop-opacity="0"/></radialGradient>
        <linearGradient id="hArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff7b4a"/></linearGradient>
        <clipPath id="hGlassClip"><path d="M238 300V388A62 62 0 0 0 362 388V300Z"/></clipPath>
        <path id="hYearPath" d="M68 300a232 232 0 1 1 464 0a232 232 0 1 1-464 0"/>
      </defs>
      <circle class="hart__halo" cx="300" cy="300" r="260" fill="url(#hHalo)"/>
      <g class="hart__ring hart__ring--outer"><circle class="hart__ticks" cx="300" cy="300" r="278"/><circle class="hart__planet hart__planet--amber" cx="300" cy="22" r="5.5"/><circle class="hart__planet hart__planet--cyan" cx="496.6" cy="496.6" r="3.6"/></g>
      <g class="hart__ring hart__ring--years"><text class="hart__years"><textPath href="#hYearPath" textLength="1440" lengthAdjust="spacing">${years}</textPath></text></g>
      <g class="hart__ring hart__ring--mid"><circle class="hart__line" cx="300" cy="300" r="204"/><circle class="hart__major" cx="300" cy="300" r="204"/><circle class="hart__planet hart__planet--violet" cx="96" cy="300" r="7"/></g>
      <g class="hart__ring hart__ring--inner"><circle class="hart__dash" cx="300" cy="300" r="162"/><circle class="hart__arc" cx="300" cy="300" r="162" stroke="url(#hArc)"/></g>
      <ellipse class="hart__shadow" cx="300" cy="492" rx="96" ry="12"/>
      <g class="hart__capsule"><g transform="rotate(26 300 300)">
        <path class="hart__glass" d="M238 300V388A62 62 0 0 0 362 388V300Z"/>
        <g clip-path="url(#hGlassClip)">
          <circle class="hart__core" cx="300" cy="372" r="84" fill="url(#hCore)"/>
          <rect class="hart__scroll" x="270" y="322" width="60" height="94" rx="9"/>
          <path class="hart__scroll-line" d="M282 342h36M282 354h36M282 366h22"/>
          <rect class="hart__ribbon" x="270" y="382" width="60" height="11"/>
          <circle class="hart__wax" cx="300" cy="387.5" r="8.5"/>
        </g>
        <path class="hart__reflection" d="M254 316V386A46 46 0 0 0 268 420"/>
        <path d="M238 300V212A62 62 0 0 1 362 212V300Z" fill="url(#hMetal)"/>
        <path class="hart__groove" d="M238 268h124M238 280h124"/>
        <circle class="hart__emblem" cx="300" cy="216" r="24"/>
        <path class="hart__hand" d="M300 202v14l9 6"/>
        <path class="hart__highlight" d="M256 284V214A44 44 0 0 1 280 176"/>
        <rect x="230" y="291" width="140" height="18" rx="9" fill="url(#hSeam)"/>
        <path class="hart__seam-light" d="M242 296h116"/>
      </g></g>
      ${[[72, 96, 14], [522, 90, 9], [550, 452, 12], [60, 474, 8], [404, 226, 6]].map(([x, y, r], i) => `<path class="hart__spark" style="animation-delay:${-i * 0.7}s" d="${sparkle(x, y, r)}"/>`).join('')}
    </svg></div>`;
  }

  /* 主视觉旁的小凭条：广场上最受期待的一枚 */
  function slip() {
    const f = HT.api.featured();
    if (!f) return '';
    return `<a class="slip" href="#/capsules/${f.code}" style="--glow:${HT.palette(f.code).glow}">
      <div class="slip__k"><span class="slip__dot"></span>广场上最受期待的一枚</div>
      <div class="slip__row">${HT.capsuleArt(f.code, 'locked', 64)}<div><b class="slip__t">${esc(f.title)}</b><span class="slip__cd mono" data-cd="${f.openAt}">${HT.cdShort(f.openAt)}</span></div></div>
      <div class="slip__f">${icon('heart')}${fmt.num(f.favoriteCount)} 人在等它</div>
    </a>`;
  }

  function hero() {
    const now = Date.now();
    return `
    <section class="hero container">
      <div class="hero__copy">
        <div class="eyebrow">HelloTime Pro · 时间胶囊</div>
        <h1 class="hero__title"><span class="hero__line">把此刻，</span><span class="hero__line">寄给<em class="hero__future">未来</em>。</span></h1>
        <p class="hero__lede">写下一段话，选定一个未来的时刻，把它封进胶囊。<br>在那之前，谁也读不到——包括你自己。</p>
        <div class="hero__cta">
          <a class="btn btn--primary btn--lg" href="#/create">${icon('pen')}写一枚胶囊</a>
          <a class="btn btn--ghost btn--lg" href="#plaza" data-to-plaza>逛逛胶囊广场${icon('arrow', 'ic--go')}</a>
        </div>
        <form class="quick card" id="quick" novalidate>
          <div class="quick__k">${icon('key')}已有胶囊码？在这里开启</div>
          <div class="quick__row">${HT.codeInput('md')}<button class="btn btn--soft" type="submit" id="quickGo">开启${icon('arrow')}</button></div>
          <div class="quick__err" id="quickErr" role="alert"></div>
        </form>
        <div class="hero__now"><span class="hero__live"></span>此刻 · <span class="mono" data-now>${fmt.date(now).replace(/\./g, '-')} ${fmt.time(now, true)}</span></div>
      </div>
      <div class="hero__art">${heroArt()}${slip()}</div>
    </section>`;
  }

  /* 年鉴数字：广场此刻的样子 */
  function stats() {
    const s = HT.api.stats();
    const far = s.farthest ? new Date(s.farthest).getFullYear() : new Date().getFullYear();
    const cells = [[s.total, '枚胶囊', '在广场上'], [s.sealed, '枚正在', '等待开启'], [s.opened, '枚已经', '被人读到'], [far, '年，最远的', '一枚才会打开']];
    return `<section class="container stats" aria-label="广场概览">${cells.map(([n, a, b], i) => `<div class="stats__cell" style="--i:${i}"><b class="mono">${n}</b><span>${a}<br>${b}</span></div>`).join('')}</section>`;
  }

  function toolbar(counts) {
    const seg = (val, label, n) => `<button class="seg__opt${Q.filter === val ? ' is-active' : ''}" type="button" data-val="${val}" aria-pressed="${Q.filter === val}">${label}<sup>${n}</sup></button>`;
    return `
    <div class="toolbar card">
      <label class="search input-wrap" id="search">
        ${icon('search', 'input-wrap__icon')}
        <input class="input" type="search" id="q" placeholder="搜索标题或昵称…" maxlength="50" autocomplete="off" value="${esc(Q.q)}" aria-label="搜索胶囊">
        <kbd class="kbd">/</kbd>
        <button class="search__x icon-btn" type="button" aria-label="清空搜索">${icon('x')}</button>
      </label>
      <div class="seg" id="segFilter" role="group" aria-label="筛选"><span class="seg__thumb"></span>
        ${seg('all', '全部', counts.all)}${seg('unopened', '封存中', counts.unopened)}${seg('opened', '已开启', counts.opened)}
      </div>
      <div class="select"><select id="sort" aria-label="排序">
        <option value="new"${Q.sort === 'new' ? ' selected' : ''}>最新封存</option>
        <option value="hot"${Q.sort === 'hot' ? ' selected' : ''}>最多收藏</option>
      </select>${icon('chev-down', 'select__arrow')}</div>
    </div>`;
  }

  function pager(p) {
    if (p.totalPages <= 1) return '';
    const nums = [];
    for (let i = 1; i <= p.totalPages; i++) {
      if (i === 1 || i === p.totalPages || Math.abs(i - p.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return `<button class="pager__btn" type="button" data-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''} aria-label="上一页">${icon('chev-left')}</button>
      ${nums.map((n) => n === '…' ? '<span class="pager__gap">…</span>' : `<button class="pager__btn${n === p.page ? ' is-active' : ''}" type="button" data-page="${n}" ${n === p.page ? 'aria-current="page"' : ''}>${n}</button>`).join('')}
      <button class="pager__btn" type="button" data-page="${p.page + 1}" ${p.page >= p.totalPages ? 'disabled' : ''} aria-label="下一页">${icon('chev-right')}</button>`;
  }

  const empty = (title, text, action) => `<div class="empty">${HT.capsuleArt(null, 'opened', 170, 'empty__art')}<h3 class="empty__title">${title}</h3><p>${text}</p>${action || ''}</div>`;

  const V = HT.skin('amber').views;
  V.plaza = {
    title: '把此刻寄给未来',
    render() {
      const r = HT.api.plaza(Q);
      return `<div class="page page--home">
        ${hero()}
        ${stats()}
        <section class="container plaza" id="plaza">
          <header class="page-head page-head--split">
            <div>
              <div class="eyebrow">Capsule Plaza</div>
              <h2 class="page-title">胶囊广场</h2>
              <p class="page-lead">这里陈列着愿意被看见的胶囊。封存中的只露出标题与倒计时；时间到了，才会交出里面的话。</p>
            </div>
            <a class="btn btn--primary" href="#/create">${icon('pen')}我也放一枚</a>
          </header>
          ${toolbar(r.counts)}
          <div class="plaza__count" id="count"></div>
          <div class="grid" id="grid" aria-live="polite"></div>
          <nav class="pager" id="pager" aria-label="分页"></nav>
        </section>
      </div>`;
    },

    mount(page) {
      const grid = $('#grid', page), pagerEl = $('#pager', page), countEl = $('#count', page);
      const input = $('#q', page), search = $('#search', page);
      let timer = 0, seq = 0;

      function paint() {
        const mode = HT.state.demo.plaza;
        if (mode === 'loading') {
          countEl.innerHTML = '<span class="sk" style="width:90px;height:14px"></span>';
          grid.innerHTML = Array.from({ length: 6 }, (_, i) => HT.cardSkeleton(i)).join('');
          pagerEl.innerHTML = '';
          return;
        }
        if (mode === 'error') {
          countEl.textContent = '';
          grid.innerHTML = empty('广场暂时打不开', '没能连上后端。请确认服务已启动，或稍后再试。', `<button class="btn btn--ghost" type="button" data-retry>${icon('refresh')}重试</button>`);
          pagerEl.innerHTML = '';
          return;
        }
        const r = mode === 'empty' ? { items: [], pagination: { page: 1, total: 0, totalPages: 1 } } : HT.api.plaza(Q);
        Q.page = r.pagination.page;
        countEl.innerHTML = `共 <b>${fmt.num(r.pagination.total)}</b> 枚胶囊${Q.q.trim() && mode !== 'empty' ? ` · 关键词「${esc(Q.q.trim())}」` : ''}`;
        if (!r.items.length) {
          grid.innerHTML = Q.q.trim() && mode !== 'empty'
            ? empty(`没有找到「${esc(Q.q.trim())}」`, '换个关键词试试，标题和昵称都可以搜。', '<button class="btn btn--ghost" type="button" data-clear>清空搜索</button>')
            : empty('广场上还没有胶囊', '来当第一个写信给未来的人？', `<a class="btn btn--primary" href="#/create">${icon('pen')}写一枚胶囊</a>`);
          pagerEl.innerHTML = '';
          return;
        }
        grid.innerHTML = r.items.map((c, i) => HT.card(c, { i, rank: Q.sort === 'hot' && Q.page === 1 && !Q.q.trim() && i < 3 ? i + 1 : 0 })).join('');
        pagerEl.innerHTML = pager(r.pagination);
      }

      function load(instant) {
        const my = ++seq;
        if (instant || HT.state.demo.plaza !== 'normal') return paint();
        grid.classList.add('is-busy');
        setTimeout(() => { if (my !== seq) return; grid.classList.remove('is-busy'); paint(); }, 240);
      }

      HT.seg($('#segFilter', page), (v) => { Q.filter = v; Q.page = 1; load(); });
      $('#sort', page).addEventListener('change', (e) => { Q.sort = e.target.value; Q.page = 1; load(); });

      const syncSearch = () => search.classList.toggle('has-value', !!input.value);
      input.addEventListener('input', () => {
        syncSearch();
        clearTimeout(timer);
        timer = setTimeout(() => { Q.q = input.value; Q.page = 1; load(); }, 300);   // 300ms 防抖
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); input.blur(); } });
      syncSearch();
      const onKey = (e) => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } };
      document.addEventListener('keydown', onKey);

      page.addEventListener('click', (e) => {
        const pg = e.target.closest('[data-page]');
        if (pg && !pg.disabled) { Q.page = +pg.dataset.page; load(true); $('#plaza', page).scrollIntoView({ behavior: HT.reduced() ? 'auto' : 'smooth', block: 'start' }); return; }
        if (e.target.closest('.search__x') || e.target.closest('[data-clear]')) { input.value = ''; Q.q = ''; Q.page = 1; syncSearch(); load(true); input.focus(); return; }
        if (e.target.closest('[data-retry]')) { HT.state.demo.plaza = 'normal'; HT.bus.emit('demo'); load(); return; }
        if (e.target.closest('[data-to-plaza]')) { e.preventDefault(); $('#plaza', page).scrollIntoView({ behavior: HT.reduced() ? 'auto' : 'smooth', block: 'start' }); }
      });

      /* 首页就地开启：输满 8 位自动查询 */
      const quickEl = $('#quick', page), quickErr = $('#quickErr', page);
      let busy = false;
      const ci = HT.bindCodeInput($('[data-code-input]', quickEl), {
        onChange: () => { quickErr.textContent = ''; },
        onComplete: (v) => go(v),
      });
      async function go(v) {
        if (busy) return;
        if ((v || '').length !== 8) { ci.error(); quickErr.textContent = '胶囊码是 8 位大写字母与数字'; ci.focus(); return; }
        busy = true; ci.setState('checking');
        await HT.sleep(520);
        busy = false; ci.setState('');
        const c = HT.api.byCode(v);
        if (!c) { ci.error(); quickErr.textContent = '没有找到这枚胶囊，请核对胶囊码'; return; }
        ci.setState('ok');
        await HT.sleep(280);
        HT.go('/capsules/' + c.code);
      }
      quickEl.addEventListener('submit', (e) => { e.preventDefault(); go(ci.value); });

      /* 每秒：更新所有倒计时；有胶囊到点就当场翻面 */
      const offTick = HT.tick.on((now) => {
        let expired = [];
        $$('[data-cd]', page).forEach((el) => {
          const at = +el.dataset.cd;
          if (at <= now) expired.push(el); else el.textContent = HT.cdShort(at, now);
        });
        const nowEl = $('[data-now]', page);
        if (nowEl) nowEl.textContent = `${fmt.date(now).replace(/\./g, '-')} ${fmt.time(now, true)}`;
        if (expired.length) {
          expired.forEach((el) => {
            const card = el.closest('.pc');
            if (card) { const art = $('.cart', card); art.classList.replace('cart--locked', 'cart--opened'); card.classList.add('is-flipping'); }
            el.removeAttribute('data-cd');
          });
          setTimeout(() => { if (!page.isConnected) return; load(true); const s = $('.slip', page); if (s) s.outerHTML = slip(); }, 1300);
        }
      });

      /* 主视觉：鼠标视差 */
      const hart = $('#hart', page);
      let raf = 0;
      const onMove = (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = hart.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
          const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
          hart.style.setProperty('--tilt-x', `${(-dy * 14).toFixed(2)}deg`);
          hart.style.setProperty('--tilt-y', `${(dx * 16).toFixed(2)}deg`);
        });
      };
      if (!HT.reduced()) window.addEventListener('mousemove', onMove, { passive: true });

      const offDemo = HT.bus.on('demo', () => load(true));
      paint();

      return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('mousemove', onMove); offTick(); offDemo(); clearTimeout(timer); };
    },
  };
})(window.HT);
