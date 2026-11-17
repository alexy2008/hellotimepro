/* ============================================================
   写一枚胶囊（/create）
   左：表单卡（标题 · AI 代笔 · 灵感 · 正文 · 开启时间 · 发布到广场）
   右：实时预览 + 须知
   封存后：胶囊合拢，8 位码牌逐个翻出
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, pad2, sleep, clamp } = HT;
  const DAY = 86400000;

  const atNine = (d) => { d.setHours(9, 0, 0, 0); return d.getTime(); };
  const PRESETS = [
    { key: '1m', label: '1 分钟后', at: () => Date.now() + 125 * 1000 },
    { key: 'tm', label: '明早 9 点', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); return atNine(d); } },
    { key: '1w', label: '一周后', at: () => { const d = new Date(); d.setDate(d.getDate() + 7); return atNine(d); } },
    { key: '1mo', label: '一个月后', at: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return atNine(d); } },
    { key: '1y', label: '一年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return atNine(d); } },
    { key: '5y', label: '五年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return atNine(d); } },
    { key: '10y', label: '十年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); d.setDate(d.getDate() - 1); return atNine(d); } },
  ];
  /* 上下限与另一套皮肤共用 */
  const minOpen = HT.LIMITS.minOpen;
  const maxOpen = HT.LIMITS.maxOpen;
  const toLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };

  const V = HT.skin('amber').views;
  V.create = {
    title: '写一枚胶囊',
    auth: true,

    render() {
      const me = HT.state.user;
      return `<div class="page page--create"><div class="container">
        <header class="page-head">
          <div class="eyebrow">Seal a capsule</div>
          <h1 class="page-title">写一枚胶囊</h1>
          <p class="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
        </header>

        <div class="create" id="create">
          <form class="create__form card" id="form" novalidate>
            <div class="field" data-field="title">
              <div class="field__head"><label class="field__label" for="title">标题 <em>*</em></label><span class="field__count mono"><b id="titleN">0</b>/60</span></div>
              <div class="input-wrap input-wrap--action">
                <input class="input" id="title" maxlength="60" autocomplete="off" placeholder="给这枚胶囊起个名字">
                <button class="ai-btn" type="button" id="aiBtn" title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题">${icon('sparkle')}<span id="aiLabel">AI 代笔</span></button>
              </div>
              <div class="field__error" id="titleErr" role="alert"></div>
            </div>

            <div class="recos" id="recos"><div class="recos__in">
              <div class="recos__head"><span>${icon('sparkle')}没有头绪？从一个灵感开始</span><button class="link-btn" type="button" id="recoMore">${icon('refresh')}换一批</button></div>
              <div class="recos__list" id="recoList"></div>
            </div></div>

            <div class="field" data-field="content">
              <div class="field__head"><label class="field__label" for="content">内容 <em>*</em></label><span class="field__count mono"><b id="contentN">0</b>/5000</span></div>
              <div class="paper" id="paper">
                <textarea class="paper__text" id="content" maxlength="5000" rows="9" placeholder="在这里写下想交给未来的话。&#10;可以是此刻的天气、正在读的书、一个小小的约定，&#10;或者只是一句：嘿，你还好吗？"></textarea>
                <div class="paper__think" aria-hidden="true"><i></i><i></i><i></i></div>
              </div>
              <div class="field__hint" id="aiNote"></div>
              <div class="field__error" id="contentErr" role="alert"></div>
            </div>

            <div class="field" data-field="openAt">
              <div class="field__head"><label class="field__label" for="openAt">开启时间 <em>*</em></label><span class="field__count">最早 1 分钟后 · 最晚 10 年内</span></div>
              <div class="input-wrap input-wrap--icon">${icon('calendar', 'input-wrap__icon')}<input class="input mono" id="openAt" type="datetime-local"></div>
              <div class="chips" id="presets">${PRESETS.map((p) => `<button class="chip" type="button" data-preset="${p.key}">${p.label}</button>`).join('')}</div>
              <div class="field__error" id="openErr" role="alert"></div>
            </div>

            <label class="toggle-card is-on" id="plazaCard">
              <span class="toggle-card__ic">${icon('globe')}</span>
              <span class="toggle-card__txt"><b>发布到胶囊广场</b><small id="plazaDesc">标题与昵称公开展示，内容到时间才可见</small></span>
              <input type="checkbox" id="inPlaza" checked class="sr-only">
              <span class="switch" aria-hidden="true"></span>
            </label>

            <div class="create__foot">
              <div class="create__sum" id="sum"></div>
              <button class="btn btn--primary btn--lg" type="submit" id="seal">${icon('lock')}<span>封存胶囊</span></button>
            </div>
          </form>

          <aside class="create__side">
            <div class="preview card" id="preview">
              <div class="preview__head"><span class="eyebrow">实时预览</span><span class="badge badge--amber">尚未封存</span></div>
              <div class="preview__art">${HT.capsuleArt(null, 'opened', 220)}</div>
              <h3 class="preview__title" id="pvTitle">未命名的胶囊</h3>
              <div class="preview__by">${HT.avatar(me.avatarId)}${esc(me.nickname)}</div>
              <dl class="preview__table">
                <div><dt>开启时间</dt><dd class="mono" id="pvOpen">—</dd></div>
                <div><dt>沉睡时长</dt><dd id="pvSpan">—</dd></div>
                <div><dt>正文</dt><dd id="pvLen">0 字</dd></div>
              </dl>
              <div class="badges" id="pvBadges"></div>
            </div>
            <ul class="notes">
              <li>${icon('key')}<span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span></li>
              <li>${icon('lock')}<span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span></li>
              <li>${icon('trash')}<span>内容和开启时间封存后不可修改；可以在「我创建的」里随时撤回。</span></li>
            </ul>
          </aside>
        </div>
      </div></div>`;
    },

    mount(page) {
      const me = HT.state.user;
      const S = { batch: 0, aiBusy: false, aiDone: false, preset: '1y', openAt: 0, inPlaza: true };
      let typeToken = 0;
      const titleEl = $('#title', page), contentEl = $('#content', page), openEl = $('#openAt', page);
      const form = $('#form', page);

      /* ---------- 同步：计数、预览、摘要 ---------- */
      function grow() { contentEl.style.height = 'auto'; contentEl.style.height = Math.max(contentEl.scrollHeight, 36 * 8) + 'px'; }
      function sync() {
        const t = titleEl.value.trim();
        $('#titleN', page).textContent = Array.from(titleEl.value).length;
        $('#contentN', page).textContent = fmt.num(contentEl.value.length);
        $('#pvTitle', page).textContent = t || '未命名的胶囊';
        $('#pvLen', page).textContent = fmt.num(contentEl.value.length) + ' 字';
        $('#recos', page).classList.toggle('is-hidden', !!t);
        $('#aiLabel', page).textContent = S.aiBusy ? '代笔中…' : S.aiDone ? '重新代笔' : 'AI 代笔';
        grow();
        saveDraft();
      }
      /* 草稿存进共享状态：切换皮肤后接着写 */
      function saveDraft() { if (S.openAt) HT.state.draft = { title: titleEl.value, content: contentEl.value, openAt: S.openAt, inPlaza: S.inPlaza }; }
      function syncTime() {
        const ok = S.openAt && !isNaN(S.openAt);
        const span = ok ? S.openAt - Date.now() : 0;
        $('#pvOpen', page).textContent = ok ? fmt.dateTime(S.openAt).replace(/\./g, '-') : '—';
        $('#pvSpan', page).textContent = ok && span > 0 ? fmt.span(span) : '—';
        $('#sum', page).innerHTML = ok && span > 0
          ? `${icon('hourglass')}<span>将沉睡 <b>${fmt.span(span)}</b>，于 ${fmt.full(S.openAt)} 开启</span>`
          : `${icon('hourglass')}<span>选一个开启的时刻</span>`;
        $$('[data-preset]', page).forEach((b) => b.classList.toggle('is-active', b.dataset.preset === S.preset));
        $('#pvBadges', page).innerHTML = (S.inPlaza ? HT.badge('plaza', 'globe', '广场公开') : HT.badge('private', 'lock', '仅凭码可见')) + HT.badge('amber', 'clock', fmt.span(Math.max(span, 0)) + '后');
        saveDraft();
      }
      function setOpen(t, preset) {
        S.openAt = t; S.preset = preset || null;
        openEl.value = toLocal(t);
        $('#openErr', page).textContent = '';
        syncTime();
      }
      const fieldErr = (id, msg) => {
        const el = $(id, page);
        el.textContent = msg;
        if (msg) { const f = el.closest('.field'); HT.shake(f); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      };

      titleEl.addEventListener('input', () => { $('#titleErr', page).textContent = ''; sync(); });
      contentEl.addEventListener('input', () => { if (S.aiBusy) stopTyping(); $('#contentErr', page).textContent = ''; sync(); });
      openEl.addEventListener('change', () => { const t = new Date(openEl.value).getTime(); if (!isNaN(t)) setOpen(t); });
      $('#presets', page).addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        const p = PRESETS.find((x) => x.key === b.dataset.preset);
        setOpen(p.at(), p.key);
      });
      $('#inPlaza', page).addEventListener('change', (e) => {
        S.inPlaza = e.target.checked;
        $('#plazaCard', page).classList.toggle('is-on', S.inPlaza);
        $('#plazaDesc', page).textContent = S.inPlaza ? '标题与昵称公开展示，内容到时间才可见' : '不出现在广场；把胶囊码交给谁，谁才能找到它';
        syncTime();
      });

      /* ---------- AI：灵感与代笔 ---------- */
      const recoList = $('#recoList', page);
      function paintRecos(loading) {
        if (loading) { recoList.innerHTML = '<i class="reco reco--sk"></i>'.repeat(4); return; }
        recoList.innerHTML = HT.RECOS[S.batch].map((r, i) => `<button class="reco" type="button" data-reco="${i}" style="--i:${i}"><b>${esc(r.title)}</b><span>${esc(r.hint)}</span><em>${icon('clock')}${fmt.span(r.openInDays * DAY)}后</em></button>`).join('');
      }
      async function loadRecos() { paintRecos(true); await sleep(620); if (page.isConnected) paintRecos(false); }

      function stopTyping() {
        typeToken++; S.aiBusy = false;
        $('#paper', page).classList.remove('is-ai', 'is-thinking');
        $('#aiBtn', page).classList.remove('is-busy');
        sync();
      }
      async function typeInto(el, text, token, step) {
        for (let i = 0; i <= text.length; i += step) {
          if (token !== typeToken || !page.isConnected) return false;
          el.value = text.slice(0, i); sync();
          await sleep(/[，。？！、—…：\n]/.test(text[i - 1] || '') ? 70 : 20);
        }
        if (token !== typeToken) return false;
        el.value = text; sync();
        return true;
      }
      async function aiWrite(forced) {
        if (S.aiBusy) return;
        const token = ++typeToken;
        let title = (forced != null ? forced : titleEl.value).trim();
        const auto = !title;
        S.aiBusy = true;
        $('#aiNote', page).innerHTML = '';
        $('#paper', page).classList.add('is-ai', 'is-thinking');
        $('#aiBtn', page).classList.add('is-busy');
        contentEl.value = ''; sync();
        await sleep(900);
        if (token !== typeToken) return;
        $('#paper', page).classList.remove('is-thinking');
        if (auto) {
          const pool = HT.RECOS[S.batch];
          title = pool[Math.floor(Math.random() * pool.length)].title;
          if (!(await typeInto(titleEl, title, token, 1))) return;
        } else if (forced != null) { titleEl.value = title; sync(); }
        const days = HT.daysFor(title);
        setOpen(atNine(new Date(Date.now() + days * DAY)));
        if (!(await typeInto(contentEl, HT.draftFor(title), token, 2))) return;
        S.aiBusy = false; S.aiDone = true;
        $('#paper', page).classList.remove('is-ai');
        $('#aiBtn', page).classList.remove('is-busy');
        $('#aiNote', page).innerHTML = `<span class="ai-note">${icon('sparkle')}${auto ? '标题与正文均由 AI 代笔' : '已为你代笔'}，建议 ${fmt.num(days)} 天后开启 · 来源 local-template</span>`;
        sync();
      }
      $('#aiBtn', page).addEventListener('click', () => aiWrite());
      $('#recoMore', page).addEventListener('click', () => { S.batch = (S.batch + 1) % HT.RECOS.length; loadRecos(); });
      recoList.addEventListener('click', (e) => { const b = e.target.closest('[data-reco]'); if (b && !S.aiBusy) aiWrite(HT.RECOS[S.batch][+b.dataset.reco].title); });

      /* ---------- 封存 ---------- */
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (S.aiBusy) stopTyping();
        const title = titleEl.value.trim(), content = contentEl.value;
        if (!title) return fieldErr('#titleErr', HT.MSG.title);
        if (!content.trim()) return fieldErr('#contentErr', HT.MSG.content);
        if (!S.openAt || isNaN(S.openAt) || S.openAt < minOpen()) return fieldErr('#openErr', HT.MSG.openMin);
        if (S.openAt > maxOpen()) return fieldErr('#openErr', HT.MSG.openMax);
        const btn = $('#seal', page);
        btn.classList.add('is-busy'); btn.disabled = true; $('span', btn).textContent = '正在封存…';
        await sleep(700);
        const c = HT.api.create({ title, content, openAt: S.openAt, inPlaza: S.inPlaza });
        HT.state.draft = null;
        showSealed(c);
      });

      function showSealed(c) {
        const box = $('#create', page);
        const head = $('.page-head', page);
        head.style.display = 'none';
        box.outerHTML = `<section class="sealed card" id="sealed" style="--glow:${HT.palette(c.code).glow}">
          <div class="sealed__art">${HT.capsuleArt(c.code, 'opened', 260)}</div>
          <div class="eyebrow eyebrow--center">Sealed</div>
          <h1 class="page-title">胶囊已封存</h1>
          <p class="page-lead">下面这串胶囊码是开启它的钥匙，${c.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。'}</p>
          <div class="tiles mono" aria-label="胶囊码 ${c.code}">${Array.from(c.code).map((ch, i) => `<span class="tile${i === 4 ? ' has-gap' : ''}" style="--i:${i}">${ch}</span>`).join('')}</div>
          <div class="sealed__act">
            <button class="btn btn--primary" type="button" data-copy-code>${icon('copy')}复制胶囊码</button>
            <button class="btn btn--ghost" type="button" data-copy-link>${icon('link')}复制开启链接</button>
          </div>
          <dl class="sealed__meta">
            <div><dt>标题</dt><dd>${esc(c.title)}</dd></div>
            <div><dt>开启时间</dt><dd class="mono">${fmt.dateTime(c.openAt).replace(/\./g, '-')}</dd></div>
            <div><dt>沉睡时长</dt><dd>${fmt.span(c.openAt - Date.now())}</dd></div>
            <div><dt>属性</dt><dd>${HT.visBadge(c)}</dd></div>
          </dl>
          <div class="sealed__links">
            <a class="link-btn" href="#/c/${c.code}">看看它的倒计时${icon('arrow')}</a>
            <button class="link-btn" type="button" data-again>再写一枚${icon('plus')}</button>
            <a class="link-btn" href="#/me/created">我创建的${icon('feather')}</a>
          </div>
        </section>`;
        const sealed = $('#sealed', page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        /* 信纸落进胶囊，两半合拢；码牌随后逐个翻出 */
        requestAnimationFrame(() => requestAnimationFrame(() => {
          $('.cart', sealed).classList.replace('cart--opened', 'cart--locked');
          sealed.classList.add('is-in');
        }));
        sealed.addEventListener('click', (e) => {
          if (e.target.closest('[data-copy-code]')) HT.copy(c.code, `已复制胶囊码 ${c.code}`);
          else if (e.target.closest('[data-copy-link]')) HT.copy(location.origin + location.pathname + '#/c/' + c.code, '已复制开启链接');
          else if (e.target.closest('[data-again]')) { HT.state.draft = null; HT.refresh(); }
        });
      }

      /* ---------- 初始化 ---------- */
      openEl.min = toLocal(minOpen());
      openEl.max = toLocal(maxOpen());
      const draft = HT.state.draft;
      if (draft && (draft.title || draft.content)) {
        titleEl.value = draft.title; contentEl.value = draft.content;
        setOpen(Math.max(draft.openAt, minOpen() + 30 * 1000));
        if (!draft.inPlaza) { const cb = $('#inPlaza', page); cb.checked = false; cb.dispatchEvent(new Event('change')); }
      } else setOpen(PRESETS[4].at(), '1y');
      sync();
      loadRecos();
      const offTick = HT.tick.on(() => { if (new Date().getSeconds() % 15 === 0 && $('#sum', page)) syncTime(); });
      setTimeout(() => { if (page.isConnected) titleEl.focus({ preventScroll: true }); }, 380);
      return () => { typeToken++; offTick(); };
    },
  };
})(window.HT);
