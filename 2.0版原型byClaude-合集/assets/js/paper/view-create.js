/* ============================================================
   创建胶囊（/create）
   左：一张红格信笺（标题 · AI 灵感 · 正文）
   右：封缄台（时间标尺 + 日历 · 是否公开 · 信封预览 · 长按封缄）
   完成后：封缄仪式 → 取信凭证（8 位胶囊码）
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, pad2, sleep, clamp } = HT;
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  /* ---------- 时间标尺：对数刻度，从「此刻」到「十年」 ---------- */
  const ANCHORS = [
    { ms: 2 * MIN, label: '此刻' },
    { ms: HOUR, label: '1 小时' },
    { ms: DAY, label: '1 天' },
    { ms: 7 * DAY, label: '1 周' },
    { ms: 30 * DAY, label: '1 个月' },
    { ms: 182 * DAY, label: '半年' },
    { ms: 365 * DAY, label: '1 年' },
    { ms: 1096 * DAY, label: '3 年' },
    { ms: 1826 * DAY, label: '5 年' },
    { ms: 3651 * DAY, label: '10 年' },
  ];
  const SEGS = ANCHORS.length - 1;
  const SEG_W = 124;
  const STRIP_W = SEGS * SEG_W;

  function vToMs(v) {
    const x = clamp(v, 0, 1) * SEGS;
    const i = Math.min(SEGS - 1, Math.floor(x));
    return ANCHORS[i].ms * Math.pow(ANCHORS[i + 1].ms / ANCHORS[i].ms, x - i);
  }
  function msToV(ms) {
    const m = clamp(ms, ANCHORS[0].ms, ANCHORS[SEGS].ms);
    for (let i = 0; i < SEGS; i++) {
      if (m <= ANCHORS[i + 1].ms) return (i + Math.log(m / ANCHORS[i].ms) / Math.log(ANCHORS[i + 1].ms / ANCHORS[i].ms)) / SEGS;
    }
    return 1;
  }
  /* 上下限与另一套皮肤共用（契约：晚于当前时间 + 1 分钟，不超过 10 年） */
  const minOpen = () => HT.LIMITS.minOpen() + 30 * 1000;
  const maxOpen = () => HT.LIMITS.maxOpen() - 5 * MIN;
  const clampOpen = (t) => clamp(t, minOpen(), maxOpen());

  /* 标尺拖出来的时长，按量级取整：越远越不需要精确到分钟 */
  function roundOpen(span) {
    const d = new Date(Date.now() + span);
    if (span < HOUR) d.setSeconds(0, 0);
    else if (span < DAY) d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    else if (span < 30 * DAY) d.setMinutes(0, 0, 0);
    else d.setHours(9, 0, 0, 0);
    return d.getTime();
  }

  const atNine = (d) => { d.setHours(9, 0, 0, 0); return d.getTime(); };
  const PRESETS = [
    { key: '1m', label: '1 分钟后', sub: '体验启封', at: () => Date.now() + 125 * 1000 },
    { key: 'tm', label: '明早 9 点', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); return atNine(d); } },
    { key: '1mo', label: '1 个月后', at: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return atNine(d); } },
    { key: '1y', label: '1 年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return atNine(d); } },
    { key: '5y', label: '5 年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return atNine(d); } },
    { key: '10y', label: '10 年后', at: () => { const d = new Date(); d.setFullYear(d.getFullYear() + 10); d.setDate(d.getDate() - 1); return atNine(d); } },
  ];

  function rulerTicks() {
    let h = '';
    for (let i = 0; i <= SEGS; i++) {
      h += `<i class="rt rt--major" style="left:${i * SEG_W}px"><b>${ANCHORS[i].label}</b></i>`;
      if (i < SEGS) for (let k = 1; k < 8; k++) h += `<i class="rt${k === 4 ? ' rt--mid' : ''}" style="left:${i * SEG_W + (k * SEG_W) / 8}px"></i>`;
    }
    return h;
  }

  /* 选中日期上的红圈：手画的，首尾不闭合；只有换了日子才重画一遍 */
  const ring = (draw) => `<svg class="cal__ring${draw ? ' is-draw' : ''}" viewBox="0 0 40 40" aria-hidden="true"><path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6"/></svg>`;

  const V = HT.skin('paper').views;
  V.create = {
    title: '写给未来的信',
    auth: true,

    render() {
      const me = HT.state.user;
      const now = Date.now();
      return `<div class="page page--create">
        <div class="wrap create">
          <header class="pagehead">
            <div>
              <div class="overline"><i></i>New capsule</div>
              <h1 class="h1">写给未来的信</h1>
            </div>
            <p class="lede">这段文字会被封存，直到你设定的时刻，<br>才能被任何人——包括你自己——打开。</p>
          </header>

          <div class="create__grid">
            <!-- ============ 信笺 ============ -->
            <section class="sheet" id="sheet" aria-label="信的内容">
              <div class="sheet__head">
                <span class="sheet__to">致 未来 ——</span>
                <button class="aibtn" type="button" id="aiBtn" title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题">
                  ${icon('sparkle')}<span id="aiLabel">AI 代笔</span>
                </button>
              </div>

              <div class="sheet__title" id="titleBox">
                <input id="title" type="text" maxlength="60" autocomplete="off" placeholder="给这封信起个标题" aria-label="标题，最多 60 字">
                <span class="sheet__n mono"><b id="titleN">0</b>/60</span>
              </div>
              <div class="sheet__err" id="titleErr" role="alert"></div>

              <div class="recos" id="recos">
                <div class="recos__in">
                  <div class="recos__head">
                    <span>${icon('sparkle')}没有头绪？从一个灵感开始</span>
                    <button class="linkbtn" type="button" id="recoMore">${icon('refresh')}换一批</button>
                  </div>
                  <div class="recos__list" id="recoList"></div>
                </div>
              </div>

              <div class="sheet__body" id="bodyBox">
                <textarea id="content" maxlength="5000" rows="9" aria-label="正文，最多 5000 字"
                  placeholder="在这里写下想传到未来的话。&#10;可以是此刻的天气、正在读的书、一个小小的许诺，&#10;或者只是一句：嘿，你还好吗？"></textarea>
                <div class="sheet__think" id="think" aria-hidden="true"><i></i><i></i><i></i></div>
              </div>
              <div class="sheet__err" id="contentErr" role="alert"></div>

              <div class="sheet__foot">
                <span class="sheet__ainote" id="aiNote"></span>
                <span class="sheet__n mono"><b id="contentN">0</b> / 5000</span>
              </div>

              <div class="sheet__sign">
                <span>——</span>${HT.avatar(me.avatarId)}<b>${esc(me.nickname)}</b>
                <span class="sheet__date">${fmt.cn(now)} ${fmt.week(now)}</span>
              </div>
            </section>

            <!-- ============ 封缄台 ============ -->
            <aside class="desk" aria-label="封缄设置">
              <section class="panel">
                <h2 class="panel__h"><span class="panel__no">壹</span>启封时刻</h2>

                <div class="presets" id="presets">
                  ${PRESETS.map((p) => `<button class="chip" type="button" data-preset="${p.key}">${p.label}${p.sub ? `<small>${p.sub}</small>` : ''}</button>`).join('')}
                </div>

                <div class="ruler" id="ruler" tabindex="0" role="slider" aria-label="启封距离：左右拖动或用方向键调整" aria-valuemin="0" aria-valuemax="100">
                  <div class="ruler__strip" id="strip">${rulerTicks()}</div>
                  <div class="ruler__needle" id="needle"></div>
                </div>

                <div class="when">
                  <div class="when__rel serif" id="sumRel"></div>
                  <div class="when__abs" id="sumAbs"></div>
                  <button class="linkbtn when__more" type="button" id="calToggle" aria-expanded="false">${icon('calendar')}<span>精确到分钟</span>${icon('chev-down', 'ic--chev')}</button>
                </div>

                <div class="calwrap" id="calWrap"><div class="calwrap__in"><div class="cal" id="cal"></div></div></div>
              </section>

              <section class="panel">
                <h2 class="panel__h"><span class="panel__no">贰</span>寄往广场</h2>
                <label class="switch">
                  <input type="checkbox" id="inPlaza" checked>
                  <span class="switch__track"><i></i></span>
                  <span class="switch__text">
                    <b id="visTitle">发布到胶囊广场</b>
                    <small id="visDesc">所有人能看到标题与倒计时；正文在启封后公开。</small>
                  </span>
                </label>
              </section>

              <section class="panel panel--seal">
                <h2 class="panel__h"><span class="panel__no">叁</span>封缄</h2>
                <div class="envf" id="envf" aria-hidden="true">
                  <div class="envf__stamp">${HT.stamp(me.avatarId, 'stamp--sm', false)}</div>
                  <div class="envf__pm">${HT.postmark({ line1: '', line2: '', cls: 'pm--envf' })}</div>
                  <div class="envf__to"><small>寄往</small><b data-env-date></b><span data-env-rel></span></div>
                  <div class="envf__title serif" data-env-title>《未命名的信》</div>
                  <div class="envf__from mono"><span>自 ${fmt.date(now)} · ${esc(me.nickname)}</span><span data-env-vis>广场公开</span></div>
                </div>

                <div class="hold-row">
                  <button class="hold" type="button" id="hold" aria-describedby="holdHint">
                    <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="hold__track" cx="60" cy="60" r="56"/><circle class="hold__prog" cx="60" cy="60" r="56" pathLength="100"/></svg>
                    ${HT.wax('封', 'hold__wax')}
                    <span class="sr-only">长按封缄</span>
                  </button>
                  <div class="hold-copy">
                    <b id="holdHint">长按火漆，封缄</b>
                    <p>封缄后不可修改、不可提前开启；<br>可以在「我创建的」里删除。</p>
                    <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>`;
    },

    mount(page) {
      const me = HT.state.user;
      const S = { title: '', content: '', openAt: 0, v: 0, inPlaza: true, preset: '1y', batch: 0, aiBusy: false, aiDone: false, calOpen: false, calMonth: null };
      let typeToken = 0;
      let cer = null;

      const titleEl = $('#title', page), contentEl = $('#content', page);
      const ruler = $('#ruler', page), strip = $('#strip', page), needle = $('#needle', page);
      const recosEl = $('#recos', page), recoList = $('#recoList', page);

      /* ---------- 信笺 ---------- */
      function grow() {
        contentEl.style.height = 'auto';
        contentEl.style.height = Math.max(contentEl.scrollHeight, 34 * 9) + 'px';
      }
      function syncText() {
        S.title = titleEl.value; S.content = contentEl.value;
        $('#titleN', page).textContent = Array.from(S.title).length;
        $('#contentN', page).textContent = fmt.num(S.content.length);
        $('[data-env-title]', page).textContent = S.title.trim() ? `《${S.title.trim()}》` : '《未命名的信》';
        recosEl.classList.toggle('is-hidden', !!S.title.trim());
        $('#aiLabel', page).textContent = S.aiBusy ? '代笔中…' : S.aiDone ? '重新代笔' : 'AI 代笔';
        grow();
        saveDraft();
      }
      /* 草稿存进共享状态：切换皮肤后接着写 */
      function saveDraft() { if (S.openAt) HT.state.draft = { title: titleEl.value, content: contentEl.value, openAt: S.openAt, inPlaza: S.inPlaza }; }
      function fieldError(which, msg) {
        const box = which === 'title' ? $('#titleBox', page) : $('#bodyBox', page);
        $(which === 'title' ? '#titleErr' : '#contentErr', page).textContent = msg;
        HT.shake(box);
        (which === 'title' ? titleEl : contentEl).focus({ preventScroll: true });
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const clearErr = () => { $('#titleErr', page).textContent = ''; $('#contentErr', page).textContent = ''; };

      titleEl.addEventListener('input', () => { clearErr(); syncText(); });
      contentEl.addEventListener('input', () => { if (S.aiBusy) stopTyping(); clearErr(); syncText(); });

      /* ---------- AI：灵感与代笔 ---------- */
      function paintRecos(loading) {
        if (loading) { recoList.innerHTML = '<i class="reco reco--sk"></i><i class="reco reco--sk"></i><i class="reco reco--sk"></i><i class="reco reco--sk"></i>'; return; }
        recoList.innerHTML = HT.RECOS[S.batch].map((r, i) =>
          `<button class="reco" type="button" data-reco="${i}" style="--i:${i}"><b>${esc(r.title)}</b><span>${esc(r.hint)}</span><em>${fmt.span(r.openInDays * DAY)}后</em></button>`).join('');
      }
      async function loadRecos() {
        paintRecos(true);
        await sleep(640);
        if (!page.isConnected) return;
        paintRecos(false);
      }

      function stopTyping() {
        typeToken++;
        S.aiBusy = false;
        $('#sheet', page).classList.remove('is-ai');
        $('#aiBtn', page).classList.remove('is-busy');
        syncText();
      }
      async function typeInto(el, text, token, step) {
        for (let i = 0; i <= text.length; i += step) {
          if (token !== typeToken || !page.isConnected) return false;
          el.value = text.slice(0, i);
          syncText();
          const ch = text[i - 1];
          await sleep(/[，。？！、—…：\n]/.test(ch || '') ? 70 : 20);
        }
        if (token !== typeToken) return false;
        el.value = text; syncText();
        return true;
      }
      async function aiWrite(forced) {
        if (S.aiBusy) return;
        const token = ++typeToken;
        let title = (forced != null ? forced : titleEl.value).trim();
        const auto = !title;
        S.aiBusy = true; clearErr();
        $('#aiNote', page).textContent = '';
        $('#sheet', page).classList.add('is-ai', 'is-thinking');
        $('#aiBtn', page).classList.add('is-busy');
        contentEl.value = '';
        syncText();
        await sleep(900);                                   // 模拟等 LLM 的首个 token
        if (token !== typeToken) return;
        $('#sheet', page).classList.remove('is-thinking');
        if (auto) {
          const pool = HT.RECOS[S.batch];
          title = pool[Math.floor(Math.random() * pool.length)].title;
          if (!(await typeInto(titleEl, title, token, 1))) return;
        } else if (forced != null) { titleEl.value = title; syncText(); }
        const days = HT.daysFor(title);
        const d = new Date(Date.now() + days * DAY);
        S.preset = null;
        setOpenAt(atNine(d), true);                         // 标尺滑到建议的时刻
        if (!(await typeInto(contentEl, HT.draftFor(title), token, 2))) return;
        S.aiBusy = false; S.aiDone = true;
        $('#sheet', page).classList.remove('is-ai');
        $('#aiBtn', page).classList.remove('is-busy');
        $('#aiNote', page).innerHTML = `${icon('sparkle')}${auto ? '标题与正文均由 AI 代笔' : '已为你代笔'}，建议 ${fmt.num(days)} 天后启封 · 来源 local-template`;
        syncText();
      }

      $('#aiBtn', page).addEventListener('click', () => aiWrite());
      $('#recoMore', page).addEventListener('click', () => { S.batch = (S.batch + 1) % HT.RECOS.length; loadRecos(); });
      recoList.addEventListener('click', (e) => {
        const b = e.target.closest('[data-reco]');
        if (!b || S.aiBusy) return;
        aiWrite(HT.RECOS[S.batch][+b.dataset.reco].title);
      });

      /* ---------- 启封时刻 ---------- */
      function setOpenAt(t, animate) {
        S.openAt = clampOpen(t);
        S.v = msToV(S.openAt - Date.now());
        ruler.classList.toggle('is-glide', !!animate);
        paintTime();
      }
      function setFromV(v) {
        S.preset = null;
        S.v = clamp(v, 0, 1);
        S.openAt = clampOpen(roundOpen(vToMs(S.v)));
        ruler.classList.remove('is-glide');
        paintTime();
      }
      function paintTime() {
        const now = Date.now();
        const span = S.openAt - now;
        strip.style.transform = `translateX(${(-S.v * STRIP_W).toFixed(1)}px)`;
        ruler.setAttribute('aria-valuenow', Math.round(S.v * 100));
        ruler.setAttribute('aria-valuetext', `${fmt.span(span)}后，${fmt.full(S.openAt)}`);
        $('#sumRel', page).textContent = fmt.span(span) + '后';
        $('#sumAbs', page).textContent = fmt.full(S.openAt);
        $('[data-env-date]', page).textContent = fmt.cn(S.openAt);
        $('[data-env-rel]', page).textContent = fmt.span(span) + '后的未来';
        const envf = $('#envf', page);
        $('.pm__l1', envf).textContent = fmt.date(S.openAt);
        $('.pm__l2', envf).textContent = fmt.time(S.openAt) + ' 启';
        $$('[data-preset]', page).forEach((b) => b.classList.toggle('is-active', b.dataset.preset === S.preset));
        if (S.calOpen) paintCal();
        saveDraft();
      }

      $('#presets', page).addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        const p = PRESETS.find((x) => x.key === b.dataset.preset);
        S.preset = p.key;
        const t = p.at();
        if (S.calOpen) S.calMonth = new Date(new Date(t).getFullYear(), new Date(t).getMonth(), 1);
        setOpenAt(t, true);
      });

      /* 标尺：拖动、点按、键盘 */
      let lastTick = -1;
      function tickFx() {
        const idx = Math.round(S.v * SEGS * 8);
        if (idx !== lastTick && needle.animate && !HT.reduced()) {
          needle.animate([{ transform: 'translateX(-50%) scaleY(1.14)' }, { transform: 'translateX(-50%) scaleY(1)' }], { duration: 150, easing: 'ease-out' });
        }
        lastTick = idx;
      }
      ruler.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        ruler.setPointerCapture(e.pointerId);
        const x0 = e.clientX, v0 = S.v;
        let moved = false;
        ruler.classList.add('is-drag');
        const move = (ev) => {
          const dx = ev.clientX - x0;
          if (Math.abs(dx) > 3) moved = true;
          if (!moved) return;
          setFromV(v0 - dx / STRIP_W);
          tickFx();
        };
        const up = (ev) => {
          ruler.classList.remove('is-drag');
          ruler.removeEventListener('pointermove', move);
          ruler.removeEventListener('pointerup', up);
          ruler.removeEventListener('pointercancel', up);
          if (!moved && ev.type === 'pointerup') {
            const r = ruler.getBoundingClientRect();
            setFromV(S.v + (ev.clientX - (r.left + r.width / 2)) / STRIP_W);
          }
          S.v = msToV(S.openAt - Date.now());                 // 松手后对齐到取整后的时刻
          ruler.classList.add('is-glide');
          paintTime();
        };
        ruler.addEventListener('pointermove', move);
        ruler.addEventListener('pointerup', up);
        ruler.addEventListener('pointercancel', up);
      });
      ruler.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.02 : 0.004;
        let v = null;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = S.v - step;
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = S.v + step;
        else if (e.key === 'PageDown') v = (Math.ceil(S.v * SEGS - 0.001) - 1) / SEGS;
        else if (e.key === 'PageUp') v = (Math.floor(S.v * SEGS + 0.001) + 1) / SEGS;
        else if (e.key === 'Home') v = 0;
        else if (e.key === 'End') v = 1;
        if (v == null) return;
        e.preventDefault();
        setFromV(v); tickFx();
      });

      /* 日历：精确到分钟 */
      const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      function paintCal() {
        const cal = $('#cal', page);
        if (!S.calMonth) { const d = new Date(S.openAt); S.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
        const y = S.calMonth.getFullYear(), mo = S.calMonth.getMonth();
        const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
        const sel = new Date(S.openAt), today = new Date();
        const lo = new Date(minOpen()); lo.setHours(0, 0, 0, 0);
        const hi = new Date(maxOpen()); hi.setHours(23, 59, 59, 999);
        const selKey = `${sel.getFullYear()}-${sel.getMonth()}-${sel.getDate()}`;
        const fresh = S.ringFor !== selKey;
        S.ringFor = selKey;
        let cells = '';
        for (let i = 0; i < 42; i++) {
          const d = new Date(y, mo, 1 - lead + i);
          const out = d.getMonth() !== mo, dis = d < lo || d > hi, isSel = sameDay(d, sel);
          cells += `<button type="button" class="cal__d${out ? ' is-out' : ''}${sameDay(d, today) ? ' is-today' : ''}${isSel ? ' is-sel' : ''}" data-d="${d.getTime()}"${dis ? ' disabled' : ''} aria-label="${fmt.cn(d.getTime())}"${isSel ? ' aria-current="date"' : ''}>${d.getDate()}${isSel ? ring(fresh) : ''}</button>`;
        }
        const prevOk = new Date(y, mo, 0) >= lo, nextOk = new Date(y, mo + 1, 1) <= hi;
        const focusT = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.t : null;
        cal.innerHTML = `
          <div class="cal__head">
            <button class="cal__nav" type="button" data-cal="-12" aria-label="上一年"${new Date(y - 1, mo + 1, 0) >= lo ? '' : ' disabled'}>«</button>
            <button class="cal__nav" type="button" data-cal="-1" aria-label="上个月"${prevOk ? '' : ' disabled'}>‹</button>
            <div class="cal__title serif"><b class="latin">${y}</b> 年 <b class="latin">${mo + 1}</b> 月</div>
            <button class="cal__nav" type="button" data-cal="1" aria-label="下个月"${nextOk ? '' : ' disabled'}>›</button>
            <button class="cal__nav" type="button" data-cal="12" aria-label="下一年"${new Date(y + 1, mo, 1) <= hi ? '' : ' disabled'}>»</button>
          </div>
          <div class="cal__dow">${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<span>${w}</span>`).join('')}</div>
          <div class="cal__grid">${cells}</div>
          <div class="cal__time">
            <span class="cal__time-k">${icon('clock')}时刻</span>
            <input class="cal__t mono" data-t="h" inputmode="numeric" maxlength="2" value="${pad2(sel.getHours())}" aria-label="小时">
            <i>:</i>
            <input class="cal__t mono" data-t="m" inputmode="numeric" maxlength="2" value="${pad2(sel.getMinutes())}" aria-label="分钟">
            <span class="cal__tz mono">${Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区'}</span>
          </div>`;
        if (focusT) { const f = $(`[data-t="${focusT}"]`, cal); if (f) f.focus(); }
      }
      const calEl = $('#cal', page);
      calEl.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-cal]');
        if (nav) { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + (+nav.dataset.cal), 1); paintCal(); return; }
        const day = e.target.closest('[data-d]');
        if (day && !day.disabled) {
          const d = new Date(+day.dataset.d), cur = new Date(S.openAt);
          d.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
          S.preset = null;
          S.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
          setOpenAt(d.getTime(), true);
        }
      });
      function commitTime(inp) {
        const cur = new Date(S.openAt);
        const max = inp.dataset.t === 'h' ? 23 : 59;
        const n = clamp(parseInt(inp.value, 10) || 0, 0, max);
        if (inp.dataset.t === 'h') cur.setHours(n); else cur.setMinutes(n);
        S.preset = null;
        setOpenAt(cur.getTime(), true);
      }
      calEl.addEventListener('change', (e) => { if (e.target.matches('.cal__t')) commitTime(e.target); });
      calEl.addEventListener('keydown', (e) => {
        if (!e.target.matches('.cal__t')) return;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const isH = e.target.dataset.t === 'h';
        const step = (e.key === 'ArrowUp' ? 1 : -1) * (isH ? 1 : 5);
        const max = isH ? 24 : 60;
        e.target.value = pad2(((parseInt(e.target.value, 10) || 0) + step + max) % max);
        commitTime(e.target);
      });
      $('#calToggle', page).addEventListener('click', (e) => {
        S.calOpen = !S.calOpen;
        e.currentTarget.setAttribute('aria-expanded', String(S.calOpen));
        e.currentTarget.classList.toggle('is-open', S.calOpen);
        $('#calWrap', page).classList.toggle('is-open', S.calOpen);
        if (S.calOpen) { S.calMonth = null; paintCal(); }
      });

      /* ---------- 是否公开 ---------- */
      $('#inPlaza', page).addEventListener('change', (e) => {
        S.inPlaza = e.target.checked;
        $('#visTitle', page).textContent = S.inPlaza ? '发布到胶囊广场' : '只凭胶囊码可见';
        $('#visDesc', page).textContent = S.inPlaza ? '所有人能看到标题与倒计时；正文在启封后公开。' : '不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。';
        $('[data-env-vis]', page).textContent = S.inPlaza ? '广场公开' : '仅凭码可见';
        $('#envf', page).classList.toggle('is-private', !S.inPlaza);
        saveDraft();
      });

      /* ---------- 长按封缄 ---------- */
      const hold = $('#hold', page), holdHint = $('#holdHint', page);
      const HOLD_MS = 1150;
      let holding = false, sealed = false, raf = 0, t0 = 0;

      function validate() {
        if (S.aiBusy) stopTyping();
        if (!S.title.trim()) { fieldError('title', HT.MSG.title); return false; }
        if (!S.content.trim()) { fieldError('content', HT.MSG.content); return false; }
        if (S.openAt < HT.LIMITS.minOpen()) { setOpenAt(minOpen(), true); HT.toast(HT.MSG.openMin + '，已为你顺延', { type: 'info' }); return false; }
        if (S.openAt > HT.LIMITS.maxOpen()) { setOpenAt(maxOpen(), true); HT.toast(HT.MSG.openMax + '，已为你调整', { type: 'info' }); return false; }
        return true;
      }
      function frame(t) {
        if (!holding) return;
        const p = clamp((t - t0) / HOLD_MS, 0, 1);
        hold.style.setProperty('--hp', p.toFixed(3));
        if (p >= 1) { holding = false; sealed = true; hold.classList.remove('is-holding'); hold.classList.add('is-done'); finish(); return; }
        raf = requestAnimationFrame(frame);
      }
      function startHold() {
        if (holding || sealed) return;
        if (!validate()) return;
        holding = true; t0 = performance.now();
        hold.classList.add('is-holding');
        holdHint.textContent = '按住，别松手…';
        raf = requestAnimationFrame(frame);
      }
      function cancelHold() {
        if (!holding) return;
        const quick = performance.now() - t0 < 320;
        holding = false; cancelAnimationFrame(raf);
        hold.classList.remove('is-holding');
        hold.style.setProperty('--hp', 0);
        holdHint.textContent = quick ? '要按住约 1 秒才会封缄' : '长按火漆，封缄';
        if (quick) HT.shake(hold);
      }
      hold.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); hold.focus({ preventScroll: true }); try { hold.setPointerCapture(e.pointerId); } catch (er) {} startHold(); });
      hold.addEventListener('pointerup', cancelHold);
      hold.addEventListener('pointercancel', cancelHold);
      hold.addEventListener('lostpointercapture', cancelHold);
      hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startHold(); } });
      hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') cancelHold(); });
      hold.addEventListener('blur', cancelHold);
      hold.addEventListener('contextmenu', (e) => e.preventDefault());

      /* ---------- 封缄仪式 ---------- */
      async function finish() {
        const c = HT.api.create({ title: S.title, content: S.content, openAt: S.openAt, inPlaza: S.inPlaza });
        HT.state.draft = null;
        const codeCells = Array.from(c.code).map((ch, i) => `<span style="--i:${i}">${ch}</span>${i === 3 ? '<i></i>' : ''}`).join('');
        cer = document.createElement('div');
        cer.className = 'cer';
        cer.setAttribute('role', 'dialog');
        cer.setAttribute('aria-modal', 'true');
        cer.setAttribute('aria-label', '封缄完成');
        cer.innerHTML = `
          <div class="cer__bg"></div>
          <div class="cer__in">
            <div class="cer__stage">${HT.envelope({ cls: 'env--cer is-open is-rising', letter: `<b>${esc(c.title)}</b><i></i><i></i><i></i><i></i>` })}</div>
            <div class="rcpt">
              <div class="rcpt__k"><span>封缄完成</span><i></i><span class="latin">Sealed</span></div>
              <h2 class="rcpt__t serif">《${esc(c.title)}》</h2>
              <p class="rcpt__w">将于 <b>${fmt.full(c.openAt)}</b> 启封<br>还要等 ${fmt.span(c.openAt - Date.now())}</p>
              <div class="rcpt__code mono" aria-label="胶囊码 ${c.code}">${codeCells}</div>
              <p class="rcpt__hint">这 8 位胶囊码是开启它的凭证。${c.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。'}</p>
              <div class="rcpt__act">
                <button class="btn btn--primary" type="button" data-copy-code>${icon('copy')}复制胶囊码</button>
                <button class="btn btn--ghost" type="button" data-copy-link>${icon('link')}复制分享链接</button>
              </div>
              <div class="rcpt__more"><a href="#/capsules/${c.code}">查看这枚胶囊${icon('arrow')}</a><button class="linkbtn" type="button" data-again>${icon('pen')}再写一枚</button></div>
            </div>
          </div>`;
        $('#overlay').appendChild(cer);
        cer.addEventListener('click', (e) => {
          if (e.target.closest('[data-copy-code]')) HT.copy(c.code, `已复制胶囊码 ${c.code}`);
          else if (e.target.closest('[data-copy-link]')) HT.copy(location.origin + location.pathname + '#/capsules/' + c.code, '已复制分享链接');
          else if (e.target.closest('[data-again]')) { closeCer(); resetForm(); }
        });
        const env = $('.env', cer);
        const quick = HT.reduced();
        await sleep(30);
        cer.classList.add('is-in');
        await sleep(quick ? 0 : 520);
        env.classList.remove('is-rising');                  // 信纸落进信封
        await sleep(quick ? 0 : 760);
        env.classList.remove('is-open');                    // 封舌合上
        await sleep(quick ? 0 : 780);
        cer.classList.add('is-stamped');                    // 火漆落下
        await sleep(quick ? 0 : 720);
        cer.classList.add('is-done');                       // 凭证滑出
        const first = $('[data-copy-code]', cer);
        if (first) first.focus({ preventScroll: true });
      }
      function closeCer() { if (cer) { cer.remove(); cer = null; } }
      function resetForm() {
        sealed = false;
        hold.classList.remove('is-done');
        hold.style.setProperty('--hp', 0);
        holdHint.textContent = '长按火漆，封缄';
        titleEl.value = ''; contentEl.value = '';
        S.aiDone = false; S.preset = '1y';
        $('#aiNote', page).textContent = '';
        syncText();
        setOpenAt(PRESETS[3].at(), true);
        HT.state.draft = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        titleEl.focus({ preventScroll: true });
      }

      /* ---------- 初始化（有草稿就接着写） ---------- */
      const draft = HT.state.draft;
      if (draft && (draft.title || draft.content)) {
        titleEl.value = draft.title; contentEl.value = draft.content;
        syncText();
        S.preset = null;
        setOpenAt(Math.max(draft.openAt, minOpen()));
        if (!draft.inPlaza) { const cb = $('#inPlaza', page); cb.checked = false; cb.dispatchEvent(new Event('change')); }
      } else {
        syncText();
        setOpenAt(PRESETS[3].at());
      }
      loadRecos();
      const offTick = HT.tick.on(() => { if (!holding && new Date().getSeconds() % 20 === 0) paintTime(); });
      setTimeout(() => { if (page.isConnected) titleEl.focus({ preventScroll: true }); }, 420);

      return () => { typeToken++; offTick(); closeCer(); cancelAnimationFrame(raf); };
    },
  };
})(window.HT);
