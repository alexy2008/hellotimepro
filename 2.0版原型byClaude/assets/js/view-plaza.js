/* ============================================================
   首页 = 胶囊广场（/）
   Hero（两个主 CTA）+ 年鉴数字 + 工具条（排序 / 筛选 / 搜索）+ 卡片网格 + 分页
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;

  /* 查询条件放在模块级：从详情页返回时，广场停在原来的位置 */
  const Q = { sort: 'new', filter: 'all', q: '', page: 1, pageSize: 9 };

  function heroArt() {
    const now = Date.now();
    const f = HT.api.featured();
    const slip = f ? `
      <a class="ha ha--slip" style="--depth:1.5" href="#/plaza/${f.id}" aria-label="广场上最受期待的胶囊：${esc(f.title)}">
        <div class="slip">
          <div class="slip__k"><span class="pulse-dot"></span>广场上最受期待的一枚</div>
          <div class="slip__t">${esc(f.title)}</div>
          <div class="slip__cd" data-cd="${f.openAt}">${HT.cdShort(f.openAt, now)}</div>
          <div class="slip__f mono"><span>${f.code}</span><span class="slip__fav">${icon('heart')}${fmt.num(f.favoriteCount)}</span></div>
        </div>
      </a>` : '';
    return `
      <div class="hero__art" id="heroArt">
        <div class="ha ha--letter" style="--depth:.45" aria-hidden="true">
          <div class="ha-letter">
            <div class="ha-letter__to">致 未来 ——</div>
            <p>见字如面。</p>
            <p>写这封信的时候，窗外正在下雨。我不知道你打开它的那天，会是什么天气。</p>
            <p>但我想，你一定还记得……</p>
          </div>
        </div>
        <div class="ha ha--env" style="--depth:.9" aria-hidden="true">${HT.envelope({ cls: 'env--hero' })}</div>
        <div class="ha ha--pm" style="--depth:1.2" aria-hidden="true">${HT.postmark({ line1: fmt.date(now), line2: '此 刻', cls: 'pm--hero' })}</div>
        ${slip}
      </div>`;
  }

  function hero() {
    const now = Date.now();
    return `
    <section class="hero">
      <div class="wrap hero__in">
        <div class="hero__copy">
          <div class="overline"><i></i>HelloTime Pro · 时间胶囊</div>
          <h1 class="hero__title">
            <span class="hero__line"><span class="hero__clip"><span>把此刻，</span></span></span>
            <span class="hero__line"><span class="hero__clip"><span>寄给<em class="hero__future" data-text="未来">未来</em></span></span>${HT.seal('封', 'solid', 'hero__dot')}</span>
          </h1>
          <p class="hero__lede">写下一段话，再选一个启封的时刻。<br>在那之前，谁也打不开它——包括你自己。</p>
          <div class="hero__cta">
            <a class="btn btn--primary btn--lg" href="#/create">${icon('pen')}<span>写一枚胶囊</span>${icon('arrow', 'ic--go')}</a>
            <a class="btn btn--ghost btn--lg" href="#/open">${icon('key')}<span>凭胶囊码开启</span></a>
          </div>
          <div class="hero__now" aria-live="off">
            <span class="hero__now-k">此刻</span>
            <span data-now-date>${fmt.cn(now)} ${fmt.week(now)}</span>
            <span class="mono hero__now-t" data-now-time>${fmt.time(now, true)}</span>
            <span class="hero__lunar" data-now-lunar>${fmt.lunar(now)}</span>
          </div>
        </div>
        ${heroArt()}
      </div>
      <div class="hero__side" aria-hidden="true"><span>见字如面</span><i></i><span class="latin">Est. 2026</span></div>
    </section>`;
  }

  function almanac() {
    const s = HT.api.stats();
    const far = s.farthest ? new Date(s.farthest).getFullYear() : new Date().getFullYear();
    return `
    <section class="wrap almanac" aria-label="广场概览">
      <div class="almanac__cell"><b class="latin" data-count="${s.total}">${s.total}</b><span>枚胶囊<br>在广场上</span></div>
      <div class="almanac__cell"><b class="latin" data-count="${s.sealed}">${s.sealed}</b><span>枚正在<br>等待启封</span></div>
      <div class="almanac__cell"><b class="latin" data-count="${s.opened}">${s.opened}</b><span>枚已经<br>被人读到</span></div>
      <div class="almanac__cell"><b class="latin" data-count="${far}" data-plain>${far}</b><span>年，最远的<br>一枚才会打开</span></div>
    </section>`;
  }

  function toolbar(counts) {
    const opt = (val, label, cur, n) => `<button class="seg__opt${cur === val ? ' is-active' : ''}" type="button" data-val="${val}" aria-pressed="${cur === val}">${label}${n != null ? `<sup>${n}</sup>` : ''}</button>`;
    return `
    <div class="toolbar">
      <div class="seg" id="segSort" role="group" aria-label="排序"><span class="seg__thumb"></span>
        ${opt('new', `${icon('clock')}最新`, Q.sort)}${opt('hot', `${icon('fire')}最热`, Q.sort)}
      </div>
      <div class="seg" id="segFilter" role="group" aria-label="筛选"><span class="seg__thumb"></span>
        ${opt('all', '全部', Q.filter, counts.all)}${opt('unopened', '未开启', Q.filter, counts.unopened)}${opt('opened', '已开启', Q.filter, counts.opened)}
      </div>
      <label class="search" id="search">
        ${icon('search')}
        <input type="search" id="q" placeholder="搜索标题或昵称" maxlength="50" autocomplete="off" value="${esc(Q.q)}" aria-label="搜索胶囊">
        <kbd>/</kbd>
        <button class="search__x" type="button" aria-label="清空搜索">${icon('x')}</button>
      </label>
    </div>`;
  }

  function pager(p) {
    if (p.totalPages <= 1) return `<div class="pager__sum">共 ${fmt.num(p.total)} 枚</div>`;
    const nums = [];
    for (let i = 1; i <= p.totalPages; i++) {
      if (i === 1 || i === p.totalPages || Math.abs(i - p.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return `
      <button class="pager__nav" type="button" data-page="${p.page - 1}" ${p.page <= 1 ? 'disabled' : ''}>${icon('chev-left')}上一页</button>
      <div class="pager__nums">${nums.map((n) => n === '…' ? '<span class="pager__gap">…</span>'
        : `<button class="pager__n latin${n === p.page ? ' is-active' : ''}" type="button" data-page="${n}" ${n === p.page ? 'aria-current="page"' : ''}>${n}</button>`).join('')}</div>
      <button class="pager__nav" type="button" data-page="${p.page + 1}" ${p.page >= p.totalPages ? 'disabled' : ''}>下一页${icon('chev-right')}</button>
      <div class="pager__sum">共 ${fmt.num(p.total)} 枚 · 第 ${p.page} / ${p.totalPages} 页</div>`;
  }

  const emptyArt = `<svg class="empty__art" viewBox="0 0 120 84" aria-hidden="true"><path d="M8 30 60 6l52 24v46H8z"/><path d="M8 30l52 30 52-30"/><path d="M34 44V22h52v22" class="empty__art-paper"/><path d="M44 30h32M44 37h20"/></svg>`;

  HT.views = HT.views || {};
  HT.views.plaza = {
    title: '把此刻寄给未来',
    render() {
      const r = HT.api.plaza(Q);
      return `<div class="page page--plaza">
        ${hero()}
        ${almanac()}
        <section class="wrap plaza" id="plaza">
          <header class="plaza__head">
            <div>
              <div class="overline"><i></i>Plaza</div>
              <h2 class="h2">胶囊广场</h2>
            </div>
            <p class="plaza__sub">别人写给未来的话。<br>有的已经启封，有的还在路上。</p>
          </header>
          ${toolbar(r.counts)}
          <div class="grid" id="grid" aria-live="polite"></div>
          <nav class="pager" id="pager" aria-label="分页"></nav>
        </section>
      </div>`;
    },

    mount(page) {
      const grid = $('#grid', page);
      const pagerEl = $('#pager', page);
      const input = $('#q', page);
      const search = $('#search', page);
      let timer = 0;
      let seq = 0;

      function paint() {
        const mode = HT.state.demo.plaza;
        if (mode === 'loading') {
          grid.innerHTML = Array.from({ length: 6 }, (_, i) => HT.cardSkeleton(i)).join('');
          pagerEl.innerHTML = '';
          return;
        }
        if (mode === 'error') {
          grid.innerHTML = `<div class="empty">${emptyArt}<h3>广场暂时打不开</h3><p>没能连上后端。请确认服务已启动，或稍后再试。</p><button class="btn btn--ghost" type="button" data-retry>${icon('refresh')}重试</button></div>`;
          pagerEl.innerHTML = '';
          return;
        }
        const r = mode === 'empty'
          ? { items: [], pagination: { page: 1, pageSize: Q.pageSize, total: 0, totalPages: 1 } }
          : HT.api.plaza(Q);
        Q.page = r.pagination.page;
        if (!r.items.length) {
          grid.innerHTML = Q.q.trim() && mode !== 'empty'
            ? `<div class="empty">${emptyArt}<h3>没有找到「${esc(Q.q.trim())}」</h3><p>换个关键词试试，标题和昵称都可以搜。</p><button class="btn btn--ghost" type="button" data-clear>清空搜索</button></div>`
            : `<div class="empty">${emptyArt}<h3>广场上还没有胶囊</h3><p>来当第一个写信给未来的人？</p><a class="btn btn--primary" href="#/create">${icon('pen')}写一枚胶囊</a></div>`;
          pagerEl.innerHTML = '';
          return;
        }
        grid.innerHTML = r.items.map((c, i) => HT.card(c, { i, rank: Q.sort === 'hot' && Q.page === 1 && !Q.q.trim() && i < 3 ? i + 1 : 0 })).join('');
        pagerEl.innerHTML = pager(r.pagination);
      }

      /* 条件变化时先给一帧骨架，让「正在取数」有迹可循 */
      function load(instant) {
        const my = ++seq;
        if (instant || HT.state.demo.plaza !== 'normal') return paint();
        grid.classList.add('is-busy');
        setTimeout(() => { if (my !== seq) return; grid.classList.remove('is-busy'); paint(); }, 220);
      }

      HT.seg($('#segSort', page), (v) => { Q.sort = v; Q.page = 1; load(); });
      HT.seg($('#segFilter', page), (v) => { Q.filter = v; Q.page = 1; load(); });

      const syncSearch = () => search.classList.toggle('has-value', !!input.value);
      input.addEventListener('input', () => {
        syncSearch();
        clearTimeout(timer);
        timer = setTimeout(() => { Q.q = input.value; Q.page = 1; load(); }, 300);   // 300ms 防抖
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; input.dispatchEvent(new Event('input')); input.blur(); } });
      syncSearch();

      const onKey = (e) => {
        if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
      };
      document.addEventListener('keydown', onKey);

      page.addEventListener('click', (e) => {
        const pg = e.target.closest('[data-page]');
        if (pg && !pg.disabled) {
          Q.page = +pg.dataset.page; load(true);
          $('#plaza', page).scrollIntoView({ behavior: HT.reduced() ? 'auto' : 'smooth', block: 'start' });
          return;
        }
        if (e.target.closest('.search__x') || e.target.closest('[data-clear]')) { input.value = ''; Q.q = ''; Q.page = 1; syncSearch(); load(true); input.focus(); return; }
        if (e.target.closest('[data-retry]')) { HT.state.demo.plaza = 'normal'; HT.bus.emit('demo'); load(); }
      });

      /* 倒计时：每秒更新所有 [data-cd]；有胶囊到点就重绘，让它当场「启封」 */
      const offTick = HT.tick.on((now) => {
        let expired = false;
        $$('[data-cd]', page).forEach((el) => {
          const at = +el.dataset.cd;
          if (at <= now) expired = true; else el.innerHTML = HT.cdShort(at, now);
        });
        $('[data-now-time]', page).textContent = fmt.time(now, true);
        if (new Date(now).getSeconds() === 0) {
          $('[data-now-date]', page).textContent = `${fmt.cn(now)} ${fmt.week(now)}`;
          $('[data-now-lunar]', page).textContent = fmt.lunar(now);
        }
        if (expired) { load(true); const art = $('#heroArt', page); if (art) art.outerHTML = heroArt(); bindArt(); }
      });

      /* Hero 小景：跟随指针的轻微视差 */
      function bindArt() {
        const art = $('#heroArt', page);
        const heroEl = $('.hero', page);
        if (!art || HT.reduced()) return;
        heroEl.onpointermove = (e) => {
          if (e.pointerType === 'touch') return;
          const r = heroEl.getBoundingClientRect();
          art.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
          art.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        };
        heroEl.onpointerleave = () => { art.style.setProperty('--mx', 0); art.style.setProperty('--my', 0); };
      }
      bindArt();

      /* 年鉴数字：进入视口时数上去 */
      const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          const el = en.target, to = +el.dataset.count, plain = el.hasAttribute('data-plain');
          if (HT.reduced()) return;
          const from = plain ? new Date().getFullYear() : 0;
          const t0 = performance.now();
          (function step(t) {
            const k = Math.min(1, (t - t0) / 900), e2 = 1 - Math.pow(1 - k, 3);
            const v = Math.round(from + (to - from) * e2);
            el.textContent = plain ? v : fmt.num(v);
            if (k < 1) requestAnimationFrame(step);
          })(t0);
        });
      }, { threshold: 0.6 }) : null;
      if (io) $$('[data-count]', page).forEach((el) => io.observe(el));

      const offDemo = HT.bus.on('demo', () => load(true));
      paint();

      return () => { document.removeEventListener('keydown', onKey); offTick(); offDemo(); clearTimeout(timer); if (io) io.disconnect(); };
    },
  };
})(window.HT);
