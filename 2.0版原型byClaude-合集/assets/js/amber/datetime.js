/* ============================================================
   皮肤「琥珀」· 开启时间选择器「星轨时钟」
   挂在 HT.skin('amber').ui 上：
     U.dateTimePicker.html()                       → 触发条 + 展开面板的 HTML
     U.dateTimePicker.mount(root, { onChange })    → { set(ms, preset), open(bool), destroy() }
   · 触发条与输入框等宽；面板接在下方展开（不浮层，不会被卡片裁掉）
   · 十年星轨：点年份穿越到那一年；拖动胶囊只换日子，时刻保留
   · 日历：方向键逐日 / 逐周；从今天到选中日之间画一条「旅程线」
   · 昼夜表盘：先拖时针，松手自动切分针；分针越过 12 点自动进退一小时
   · 所有改动都夹在 HT.LIMITS 的上下限里；贴边时底栏给出提示
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, icon, pad2, clamp } = HT;
  const U = HT.skin('amber').ui;

  const MIN = 60000, DAY = 86400000;
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  /* 换到另一年 / 另一个月时，日子超出当月天数就落在月末（2 月 29 日 → 2 月 28 日） */
  const moveTo = (ms, y, m) => { const d = new Date(ms); const day = d.getDate(); d.setDate(1); d.setFullYear(y, m); d.setDate(Math.min(day, dim(y, m))); return d.getTime(); };
  const addYears = (ms, n) => { const d = new Date(ms); return moveTo(ms, d.getFullYear() + n, d.getMonth()); };
  const addMonths = (ms, n) => { const d = new Date(ms); const t = new Date(d.getFullYear(), d.getMonth() + n, 1); return moveTo(ms, t.getFullYear(), t.getMonth()); };
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function rel(t) {
    const ms = t - Date.now();
    if (ms < 3600000) return `${Math.max(1, Math.round(ms / MIN))} 分钟后`;
    if (ms < DAY) return `${Math.round(ms / 3600000)} 小时后`;
    if (ms < 45 * DAY) return `${Math.round(ms / DAY)} 天后`;
    if (ms < 330 * DAY) return `约 ${Math.round(ms / (30.44 * DAY))} 个月后`;
    return `约 ${Math.round(ms / (365.25 * DAY))} 年后`;
  }
  /* 精确倒计时：按日历年、月逐级扣，剩下的换算成天 / 时 / 分；四舍五入到分钟 */
  function eta(t) {
    t += 30000;
    let cur = Date.now(), y = 0, mo = 0;
    while (addYears(cur, 1) <= t) { cur = addYears(cur, 1); y++; }
    while (addMonths(cur, 1) <= t) { cur = addMonths(cur, 1); mo++; }
    let ms = Math.max(0, t - cur);
    const d = Math.floor(ms / DAY); ms -= d * DAY;
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / MIN);
    const parts = [];
    if (y) parts.push(`<b>${y}</b>年`);
    if (mo) parts.push(`<b>${mo}</b>个月`);
    if (d) parts.push(`<b>${d}</b>天`);
    parts.push(`<b>${h}</b>小时`, `<b>${m}</b>分`);
    return parts.join(' ');
  }

  /* ---------------- 模板 ---------------- */
  function dialSvg() {
    let ticks = '', nums = '', bezel = '';
    for (let i = 0; i < 60; i++) {
      const a = i * 6 * Math.PI / 180, five = i % 5 === 0, r1 = five ? 92 : 96;
      ticks += `<line class="clock__tick${five ? ' is-5' : ''}" x1="${(110 + r1 * Math.sin(a)).toFixed(2)}" y1="${(110 - r1 * Math.cos(a)).toFixed(2)}" x2="${(110 + 100 * Math.sin(a)).toFixed(2)}" y2="${(110 - 100 * Math.cos(a)).toFixed(2)}"/>`;
      /* 刻度圈：0 点琥珀三角，10/20…50 数字，其余每 5 分一道短条，前 15 分钟逐分细刻 */
      const rot = `transform="rotate(${i * 6} 110 110)"`;
      if (i === 0) bezel += '<path class="clock__lume" d="M106 -9h8L110 -3Z"/>';
      else if (i % 10 === 0) bezel += `<text class="clock__bz clock__bz-n" x="110" y="-5.5" ${rot}>${i}</text>`;
      else if (five) bezel += `<rect class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" ${rot}/>`;
      else if (i < 15) bezel += `<rect class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" ${rot}/>`;
      else bezel += `<circle class="clock__bz" cx="110" cy="-5.5" r=".7" ${rot}/>`;
    }
    for (let h = 1; h <= 12; h++) {
      if (h === 3) continue; // 3 点位让给日历窗
      const a = h * 30 * Math.PI / 180;
      nums += `<text class="clock__num${h % 3 === 0 ? ' is-q' : ''}" x="${(110 + 78 * Math.sin(a)).toFixed(2)}" y="${(110 - 78 * Math.cos(a)).toFixed(2)}">${h}</text>`;
    }
    return `<div class="clock__case"><i class="clock__crown" aria-hidden="true"></i>
      <svg class="clock__dial" data-dial viewBox="-12 -12 244 244" tabindex="0" role="slider" aria-label="表盘：拖动指针调整时刻">
        <defs>
          <linearGradient id="amber-dtp-hand" gradientUnits="userSpaceOnUse" x1="110" y1="118" x2="110" y2="58"><stop class="clock__g-hand-a" offset="0"/><stop class="clock__g-hand-b" offset="1"/></linearGradient>
          <radialGradient id="amber-dtp-day" cx=".5" cy=".78" r=".75"><stop class="clock__g-day" offset="0" stop-opacity=".35"/><stop class="clock__g-day" offset="1" stop-opacity="0"/></radialGradient>
          <radialGradient id="amber-dtp-night" cx=".5" cy=".3" r=".8"><stop class="clock__g-night" offset="0" stop-opacity=".32"/><stop class="clock__g-night" offset="1" stop-opacity="0"/></radialGradient>
          <radialGradient id="amber-dtp-edge" cx=".5" cy=".5" r=".5"><stop class="clock__g-edge" offset=".82" stop-opacity="0"/><stop class="clock__g-edge" offset="1" stop-opacity=".22"/></radialGradient>
          <clipPath id="amber-dtp-face"><circle cx="110" cy="110" r="110"/></clipPath>
        </defs>
        <circle class="clock__face" cx="110" cy="110" r="110"/>
        <g clip-path="url(#amber-dtp-face)">
          <g class="clock__sky clock__sky--day"><rect width="220" height="220" fill="url(#amber-dtp-day)"/><circle class="clock__sun" cx="110" cy="160" r="13"/><circle class="clock__sun clock__sun--halo" cx="110" cy="160" r="22"/></g>
          <g class="clock__sky clock__sky--night"><rect width="220" height="220" fill="url(#amber-dtp-night)"/><path class="clock__moon" d="M118 150a12 12 0 1 1-12.5-14 9.5 9.5 0 0 0 12.5 14Z"/>
            <g class="clock__stars"><circle cx="72" cy="68" r="1.2" opacity=".8"/><circle cx="150" cy="62" r="1" opacity=".6"/><circle cx="160" cy="140" r="1.4" opacity=".7"/><circle cx="58" cy="132" r="1" opacity=".5"/><circle cx="132" cy="172" r=".9" opacity=".6"/><circle cx="84" cy="172" r="1.1" opacity=".5"/></g></g>
        </g>
        <circle class="clock__vignette" cx="110" cy="110" r="110" fill="url(#amber-dtp-edge)"/>
        <circle class="clock__rehaut" cx="110" cy="110" r="102"/>
        <g>${ticks}</g><g>${nums}</g><g>${bezel}</g>
        <text class="clock__brand" x="110" y="64">HELLOTIME</text>
        <text class="clock__brand clock__brand--sub" x="110" y="74">Automatic · Sealed</text>
        <g class="clock__date"><rect x="163" y="101" width="24" height="18" rx="3"/><text data-datewin x="175" y="110.5"></text></g>
        <g class="clock__hand clock__hand--h" data-hand="h"><line x1="110" y1="118" x2="110" y2="58"/></g>
        <g class="clock__hand clock__hand--m" data-hand="m"><line x1="110" y1="124" x2="110" y2="44"/><circle class="knob" cx="110" cy="44" r="4.5"/></g>
        <circle class="clock__pin" cx="110" cy="110" r="6"/>
        <path class="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z"/>
      </svg></div>`;
  }

  function html() {
    return `<div class="dtp">
      <button class="dtp__trigger" type="button" id="openAt" aria-haspopup="dialog" aria-expanded="false" aria-controls="dtpPanel" aria-describedby="dtpVal">
        ${icon('calendar', 'ic--cal')}
        <span class="dtp__val" id="dtpVal"><span class="dtp__date"></span><span class="dtp__wd"></span><span class="dtp__time"></span></span>
        <span class="dtp__rel"></span>
        ${icon('chev-down', 'ic--chev')}
      </button>
      <div class="dtp__panel" id="dtpPanel" role="dialog" aria-label="选择开启时间">
        <div class="dtp__clip"><div class="dtp__in">
          <div class="orbit">
            <div class="dtp__k">十年星轨<b data-pct></b></div>
            <div class="orbit__rail" data-rail>
              <div class="orbit__line"></div>
              <div class="orbit__trail" data-trail></div>
              <div data-nodes></div>
              <div class="orbit__cap" data-cap tabindex="0" role="slider" aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）">
                <svg viewBox="0 0 32 32" aria-hidden="true"><path class="orbit__cap-top" d="M9 16V11a7 7 0 0 1 14 0v5Z"/><path class="orbit__cap-bot" d="M9 16v5a7 7 0 0 0 14 0v-5Z"/><rect class="orbit__cap-seam" x="8" y="15" width="16" height="2.2" rx="1.1"/></svg>
              </div>
            </div>
          </div>
          <div class="dtp__body">
            <div class="mcal">
              <div class="mcal__head">
                <div class="mcal__title" data-caltitle></div>
                <button class="mcal__nav" type="button" data-calnav="-1" aria-label="上个月">${icon('chev-left')}</button>
                <button class="mcal__nav" type="button" data-calnav="1" aria-label="下个月">${icon('chev-right')}</button>
              </div>
              <div class="mcal__dow">${['一', '二', '三', '四', '五', '六', '日'].map((w) => `<span>${w}</span>`).join('')}</div>
              <div class="mcal__grid" data-grid role="grid" aria-label="日期"></div>
            </div>
            <div class="clock is-day" data-clock data-mode="h">
              <div class="clock__read">
                <div class="clock__seg"><button type="button" data-seg="h" class="is-on" aria-label="调小时"></button><i>:</i><button type="button" data-seg="m" aria-label="调分钟"></button></div>
                <div class="ampm"><button type="button" data-ampm="am">${icon('sun')}上午</button><button type="button" data-ampm="pm">${icon('moon')}下午</button></div>
              </div>
              ${dialSvg()}
              <div class="clock__hint" data-hint></div>
            </div>
          </div>
          <div class="dtp__foot">
            <div class="dtp__eta" data-eta></div>
            <button class="btn btn--primary btn--sm" type="button" data-done>就这一刻</button>
          </div>
        </div></div>
      </div>
    </div>`;
  }

  /* 展开时把整块面板滚进视口：和展开动画同时进行；
     向上滚的距离以「触发条不被顶部导航挡住」为限，底部避开手机底栏 */
  function reveal(root) {
    const trig = root.querySelector('.dtp__trigger'), inner = root.querySelector('.dtp__in');
    if (!trig || !inner) return;
    const top = trig.getBoundingClientRect().top;
    const need = top + trig.offsetHeight + inner.offsetHeight;
    const bar = document.querySelector('.tabbar');
    const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().height : 0;
    const headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
    const over = need - (window.innerHeight - barH - 16);
    const dy = Math.min(over, top - headH - 16);
    if (dy > 0) window.scrollBy({ top: dy, behavior: HT.reduced && HT.reduced() ? 'auto' : 'smooth' });
  }

  /* ---------------- 行为 ---------------- */
  function mount(root, opts) {
    const { minOpen, maxOpen } = HT.LIMITS;
    const S = { t: Date.now() + DAY, view: null, mode: 'h', clamped: false, angH: null, angM: null };
    const q = (s) => $(s, root);
    const trigger = q('.dtp__trigger'), rail = q('[data-rail]'), cap = q('[data-cap]'), grid = q('[data-grid]');
    const clock = q('[data-clock]'), dial = q('[data-dial]');

    const follow = () => { const d = new Date(S.t); S.view = new Date(d.getFullYear(), d.getMonth(), 1); };
    /* 用户在面板里改动：夹进上下限 → 回调给页面 */
    function pick(t, keepView) {
      const c = clamp(t, minOpen(), maxOpen());
      S.clamped = c !== t;
      S.t = c;
      if (!keepView) follow();
      render();
      opts.onChange(c);
    }

    /* 十年星轨 */
    const Y0 = new Date().getFullYear();
    q('[data-nodes]').innerHTML = Array.from({ length: 11 }, (_, i) =>
      `<button class="orbit__node" type="button" data-i="${i}" style="left:${i * 10}%" aria-label="穿越到 ${Y0 + i} 年"><i></i><span>${i ? Y0 + i : '今年'}</span></button>`).join('');
    const frac = (t) => clamp((t - Date.now()) / (maxOpen() - Date.now()), 0, 1);
    q('[data-nodes]').addEventListener('click', (e) => {
      const b = e.target.closest('.orbit__node');
      if (b) pick(moveTo(S.t, new Date().getFullYear() + +b.dataset.i, new Date(S.t).getMonth()));
    });
    function railTime(x) {
      const r = rail.getBoundingClientRect(), cur = new Date(S.t);
      const d = new Date(Date.now() + clamp((x - r.left) / r.width, 0, 1) * (maxOpen() - Date.now()));
      d.setHours(cur.getHours(), cur.getMinutes(), 0, 0); // 只换日子，时刻保留
      return d.getTime();
    }
    let railDrag = false;
    rail.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.orbit__node')) return;
      railDrag = true; rail.classList.add('is-drag');
      try { rail.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有活动指针 */ }
      pick(railTime(e.clientX));
    });
    rail.addEventListener('pointermove', (e) => { if (railDrag) pick(railTime(e.clientX)); });
    const endRail = () => { railDrag = false; rail.classList.remove('is-drag'); };
    rail.addEventListener('pointerup', endRail);
    rail.addEventListener('pointercancel', endRail);
    cap.addEventListener('keydown', (e) => {
      const n = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      const y = { PageUp: 1, PageDown: -1 }[e.key];
      if (!n && !y) return;
      e.preventDefault();
      pick(n ? addMonths(S.t, n) : addYears(S.t, y));
    });

    /* 日历 */
    root.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-calnav]');
      if (nav) { S.view = new Date(S.view.getFullYear(), S.view.getMonth() + +nav.dataset.calnav, 1); renderCal(); }
    });
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.mcal__d');
      if (!b || b.disabled) return;
      const [y, m, d] = b.dataset.d.split('-').map(Number), cur = new Date(S.t);
      pick(new Date(y, m, d, cur.getHours(), cur.getMinutes()).getTime(), true);
    });
    grid.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!step) return;
      e.preventDefault();
      pick(S.t + step * DAY);
      const sel = grid.querySelector('.is-sel'); if (sel) sel.focus();
    });
    function renderCal() {
      const y = S.view.getFullYear(), mo = S.view.getMonth(), today = new Date();
      const yrs = y - today.getFullYear();
      q('[data-caltitle]').innerHTML = `${y} 年 ${mo + 1} 月<small>${yrs ? yrs + ' 年后' : '今年'}</small>`;
      const lo = new Date(minOpen()); lo.setHours(0, 0, 0, 0);
      const hi = new Date(maxOpen()); hi.setHours(23, 59, 59, 999);
      q('[data-calnav="-1"]').disabled = new Date(y, mo, 0) < lo;
      q('[data-calnav="1"]').disabled = new Date(y, mo + 1, 1) > hi;
      const lead = (new Date(y, mo, 1).getDay() + 6) % 7;
      const sel = new Date(S.t), t0 = new Date(today), s0 = new Date(sel);
      t0.setHours(0, 0, 0, 0); s0.setHours(0, 0, 0, 0);
      let out = '';
      for (let i = 0; i < 42; i++) {
        const d = new Date(y, mo, 1 - lead + i), isSel = sameDay(d, sel);
        const cls = ['mcal__d'];
        if (d.getMonth() !== mo) cls.push('is-out');
        if (sameDay(d, today)) cls.push('is-today');
        if (d > t0 && d < s0) cls.push('is-span');
        if (isSel) cls.push('is-sel');
        out += `<button type="button" role="gridcell" class="${cls.join(' ')}" data-d="${d.getFullYear()}-${d.getMonth()}-${d.getDate()}"${d < lo || d > hi ? ' disabled' : ''} tabindex="${isSel ? 0 : -1}" aria-selected="${isSel}" aria-label="${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日">${d.getDate()}</button>`;
      }
      grid.innerHTML = out;
    }

    /* 表盘 */
    function setMode(m) {
      S.mode = m; clock.dataset.mode = m;
      root.querySelectorAll('[data-seg]').forEach((b) => b.classList.toggle('is-on', b.dataset.seg === m));
      q('[data-hint]').textContent = m === 'h' ? '拖动时针，松手后自动切到分针' : '拖动分针，越过 12 点会自动进退一小时';
    }
    const setHM = (h, m) => { const d = new Date(S.t); d.setHours(h, m, 0, 0); pick(d.getTime()); };
    root.addEventListener('click', (e) => {
      const seg = e.target.closest('[data-seg]');
      if (seg) return setMode(seg.dataset.seg);
      const ap = e.target.closest('[data-ampm]');
      if (!ap) return;
      const d = new Date(S.t), h = d.getHours();
      if (ap.dataset.ampm === 'am' && h >= 12) setHM(h - 12, d.getMinutes());
      if (ap.dataset.ampm === 'pm' && h < 12) setHM(h + 12, d.getMinutes());
    });
    function dialApply(e) {
      const r = dial.getBoundingClientRect();
      const a = (Math.atan2(e.clientX - (r.left + r.width / 2), (r.top + r.height / 2) - e.clientY) * 180 / Math.PI + 360) % 360;
      const d = new Date(S.t), h = d.getHours(), m = d.getMinutes();
      if (S.mode === 'h') return setHM(Math.round(a / 30) % 12 + (h >= 12 ? 12 : 0), m);
      const nm = Math.round(a / 6) % 60;
      setHM(m >= 45 && nm < 15 ? h + 1 : m < 15 && nm >= 45 ? h - 1 : h, nm); // 越过 12 点进退一小时
    }
    let dialDrag = false;
    dial.addEventListener('pointerdown', (e) => {
      dialDrag = true; dial.classList.add('is-drag');
      try { dial.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有活动指针 */ }
      dialApply(e);
    });
    dial.addEventListener('pointermove', (e) => { if (dialDrag) dialApply(e); });
    const endDial = () => { if (!dialDrag) return; dialDrag = false; dial.classList.remove('is-drag'); if (S.mode === 'h') setMode('m'); };
    dial.addEventListener('pointerup', endDial);
    dial.addEventListener('pointercancel', endDial);
    dial.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); return setMode(S.mode === 'h' ? 'm' : 'h'); }
      const k = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key];
      if (!k) return;
      e.preventDefault();
      pick(S.t + k * (S.mode === 'h' ? 60 : 1) * MIN);
    });
    /* 角度累加：59→0 时指针向前走一格，而不是倒转一整圈 */
    const unwrap = (prev, next) => (prev == null ? next : prev + (((next - prev) % 360) + 540) % 360 - 180);
    function renderClock() {
      const d = new Date(S.t), h = d.getHours(), m = d.getMinutes();
      S.angH = unwrap(S.angH, (h % 12 + m / 60) * 30);
      S.angM = unwrap(S.angM, m * 6);
      q('[data-hand="h"]').style.transform = `rotate(${S.angH}deg)`;
      q('[data-hand="m"]').style.transform = `rotate(${S.angM}deg)`;
      q('[data-seg="h"]').textContent = pad2(h);
      q('[data-seg="m"]').textContent = pad2(m);
      q('[data-ampm="am"]').classList.toggle('is-on', h < 12);
      q('[data-ampm="pm"]').classList.toggle('is-on', h >= 12);
      q('[data-datewin]').textContent = d.getDate();
      const day = h >= 6 && h < 18;
      clock.classList.toggle('is-day', day);
      clock.classList.toggle('is-night', !day);
      dial.setAttribute('aria-valuetext', `${h} 点 ${m} 分`);
    }

    function render() {
      const d = new Date(S.t), f = frac(S.t);
      q('.dtp__date').textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
      q('.dtp__wd').textContent = WD[d.getDay()];
      q('.dtp__time').textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      q('.dtp__rel').textContent = rel(S.t);
      cap.style.left = q('[data-trail]').style.width = `${(f * 100).toFixed(2)}%`;
      cap.setAttribute('aria-valuetext', `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`);
      q('[data-pct]').textContent = `${(f * 10).toFixed(1)} / 10 年`;
      const Y = new Date().getFullYear();
      root.querySelectorAll('.orbit__node').forEach((n, i) => {
        n.classList.toggle('is-past', i > 0 && i / 10 <= f + 1e-6);
        n.classList.toggle('is-cur', Y + i === d.getFullYear());
      });
      renderCal();
      renderClock();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
      q('[data-eta]').innerHTML = `胶囊将在 ${eta(S.t)} 后开启` + (S.clamped
        ? `<small class="is-warn">已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${tz}</small>`
        : `<small>按你所在的时区 ${tz} 计时</small>`);
    }

    /* 开合：点触发条切换；「就这一刻」、Esc、点到组件与预设之外都收起 */
    const isOpen = () => root.classList.contains('is-open');
    /* 展开动画一开始文档还没变长，reveal 的滚动会被当时的最大滚动距离截断：
       动画结束（transitionend，约 500ms 定时兜底）后再补一次，只补剩下的距离；收起或销毁时清掉 */
    let stopSettle = null;
    function cancelSettle() { if (stopSettle) stopSettle(); }
    function settleReveal() {
      cancelSettle();
      const panel = q('.dtp__panel');
      let timer = 0;
      const stop = () => { clearTimeout(timer); panel.removeEventListener('transitionend', onEnd); if (stopSettle === stop) stopSettle = null; };
      const fire = () => { stop(); if (isOpen()) reveal(root); };
      const onEnd = (e) => { if (e.target === panel && e.propertyName === 'grid-template-rows') fire(); };
      panel.addEventListener('transitionend', onEnd);
      timer = setTimeout(fire, 500);
      stopSettle = stop;
    }
    function open(o) {
      root.classList.toggle('is-open', o);
      trigger.setAttribute('aria-expanded', String(o));
      cancelSettle();
      if (!o) setMode('h');
      else { requestAnimationFrame(() => reveal(root)); settleReveal(); }
    }
    trigger.addEventListener('click', () => open(!isOpen()));
    q('[data-done]').addEventListener('click', () => { open(false); trigger.focus({ preventScroll: true }); });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); open(false); trigger.focus({ preventScroll: true }); }
    });
    const outside = (e) => { if (isOpen() && !root.contains(e.target) && !e.target.closest('[data-preset]')) open(false); };
    document.addEventListener('pointerdown', outside);

    setMode('h');
    return {
      /* 页面（预设、AI 代笔、草稿恢复）改了时间：只刷新显示，不回调 */
      set(t) { S.t = t; S.clamped = false; follow(); render(); },
      refresh() { render(); },
      open,
      destroy() { cancelSettle(); document.removeEventListener('pointerdown', outside); },
    };
  }

  U.dateTimePicker = { html, mount };
})(window.HT);
