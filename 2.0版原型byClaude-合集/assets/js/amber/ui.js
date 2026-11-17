/* ============================================================
   皮肤「琥珀与夜空」· 视觉部件
   挂在 HT.skin('amber').ui 上；切换到这套皮肤时并入 HT，
   所以页面里的 HT.card / HT.avatar 等调用，永远指向当前皮肤的实现
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, pad2, clamp, sleep, reduced } = HT;
  const U = HT.skin('amber').ui;

  /* ---------------- 视觉部件 ---------------- */

  /* 胶囊专属配色：同一个胶囊码永远是同一种颜色。
     用 OKLCH 固定亮度与彩度、只变色相，任何色相看上去都一样鲜亮 */
  function hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function paletteFromHue(hue, hue2) {
    return {
      hue,
      capLight: `oklch(0.84 0.14 ${hue})`,
      capDeep: `oklch(0.63 0.19 ${hue})`,
      accent: `oklch(0.78 0.13 ${hue2})`,
      glow: `oklch(0.72 0.17 ${hue} / 0.34)`,
    };
  }
  U.palette = (code) => {
    const h = hash(code || 'HELLOTIME');
    const hue = h % 360;
    return paletteFromHue(hue, (hue + 40 + ((h >>> 9) % 41)) % 360);
  };
  U.BRAND = paletteFromHue(68, 300);

  /* 胶囊插画：全站反复出现的母题。左半是专属配色的舱盖，右半是能看见信纸的玻璃舱。
     locked 合拢上锁；opened 两半分开、信纸升起。切换形态只需改 class，过渡由 CSS 完成 */
  let artSeq = 0;
  U.capsuleArt = (code, state, width, cls) => {
    const p = code ? HT.palette(code) : HT.BRAND;
    const id = 'ca' + (++artSeq);
    const w = width || 200;
    return `<svg class="cart cart--${state || 'locked'}${cls ? ' ' + cls : ''}" width="${w}" height="${w / 2}" viewBox="0 0 240 120" style="--cap-glow:${p.glow}" aria-hidden="true">
      <defs>
        <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.capLight}"/><stop offset="1" stop-color="${p.capDeep}"/></linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".42"/></linearGradient>
      </defs>
      <ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6"/>
      <g class="cart__paper"><rect x="98" y="24" width="44" height="62" rx="5"/><path d="M106 40h28M106 50h28M106 60h17"/></g>
      <g class="cart__cap"><path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill="url(#${id}c)"/><path class="cart__groove" d="M104 31v58M111 31v58"/><path class="cart__shine" d="M60 41h36"/></g>
      <g class="cart__body"><path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill="url(#${id}g)"/><rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6"/><path class="cart__scroll-line" d="M141 56h30M141 64h19"/><path class="cart__shine" d="M132 40h40"/></g>
      <rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5"/>
      <circle class="cart__lock" cx="120" cy="60" r="4.5"/>
    </svg>`;
  };

  /* 标志：一枚被时间轨道环绕的倾斜胶囊 */
  let logoSeq = 0;
  U.logo = (size, cls) => {
    const u = 'lg' + (++logoSeq);
    const s = size || 34;
    return `<svg class="logo${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="${u}n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34267e"/><stop offset="1" stop-color="#0a0e28"/></linearGradient>
        <linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe59a"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff7a45"/></linearGradient>
        <linearGradient id="${u}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9d1ff"/></linearGradient>
        <radialGradient id="${u}w" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#${u}n)"/>
      <circle cx="32" cy="32" r="24" fill="url(#${u}w)"/>
      <g transform="rotate(45 32 32)">
        <path d="M5 32A27 8 0 0 1 59 32" fill="none" stroke="#b9afff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.5 3.4"/>
        <path d="M22 32V22a10 10 0 0 1 20 0v10Z" fill="url(#${u}a)"/>
        <path d="M22 32v10a10 10 0 0 0 20 0V32Z" fill="url(#${u}g)"/>
        <rect x="26.5" y="35.5" width="11" height="10.5" rx="2" fill="#ffd98a" fill-opacity=".9"/>
        <path d="M28.8 39h6.4M28.8 42h4.6" stroke="#b06a1c" stroke-width="1.1" stroke-linecap="round"/>
        <rect x="20.6" y="30.4" width="22.8" height="3.2" rx="1.6" fill="#1b1550"/>
        <path d="M26.2 23a5.8 5.8 0 0 1 4.2-5.8" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round"/>
        <path d="M5 32A27 8 0 0 0 59 32" fill="none" stroke="#d9d3ff" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="51" cy="37.2" r="2.6" fill="#ffd27a"/>
      </g>
      <path d="M13 43q.5 3.5 4 4-3.5.5-4 4-.5-3.5-4-4 3.5-.5 4-4Z" fill="#ffe59a"/>
      <circle cx="50.5" cy="13.5" r="1.4" fill="#fff" fill-opacity=".9"/><circle cx="44" cy="8.5" r=".8" fill="#fff" fill-opacity=".6"/>
    </svg>`;
  };

  /* 头像：一颗带光泽的小星球，内置头像的徽记刻在上面 */
  const avatarOf = (id) => HT.AVATARS.find((a) => a.id === id) || HT.AVATARS[0];
  U.avatarOf = avatarOf;
  U.avatar = (id, cls) => {
    const a = avatarOf(id);
    return `<span class="av${cls ? ' ' + cls : ''}" style="--av:${a.color}" aria-hidden="true"><svg viewBox="0 0 24 24">${a.glyph}</svg></span>`;
  };

  /* 邮戳：外圈文字沿圆排布，略微歪斜，像用手盖上去的 */
  let stampSeq = 0;
  U.stamp = (date, label, cls) => {
    const id = 'st' + (++stampSeq);
    return `<svg class="stamp${cls ? ' ' + cls : ''}" viewBox="0 0 140 140" aria-hidden="true">
      <defs><path id="${id}" d="M18 70a52 52 0 1 1 104 0a52 52 0 1 1-104 0"/></defs>
      <circle class="stamp__ring" cx="70" cy="70" r="66"/><circle class="stamp__ring stamp__ring--in" cx="70" cy="70" r="40"/>
      <text class="stamp__arc"><textPath href="#${id}" textLength="316" lengthAdjust="spacing">HELLOTIME PRO · 时间胶囊 · TIME CAPSULE ·</textPath></text>
      <text class="stamp__label" x="70" y="68" text-anchor="middle">${label || '已开启'}</text>
      <text class="stamp__date" x="70" y="86" text-anchor="middle">${fmt.date(date)}</text>
    </svg>`;
  };

  U.badge = (kind, ic, text) => `<span class="badge badge--${kind}">${ic ? icon(ic) : ''}${text}</span>`;
  U.visBadge = (c) => c.inPlaza ? HT.badge('plaza', 'globe', '广场公开') : HT.badge('private', 'lock', '仅凭码可见');
  U.stateBadge = (c) => c.isOpened ? HT.badge('opened', 'mail', '已开启') : HT.badge('locked', 'lock', '封存中');

  /* 紧凑倒计时（卡片用）：00:59:12 或 3508 天 23:54:25 */
  U.cdShort = (openAt, now) => {
    const c = fmt.cd(openAt, now);
    const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
    return c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
  };

  const preview = (text, n) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > (n || 80) ? t.slice(0, n || 80) + '……' : t; };
  U.preview = preview;

  /* 收藏按钮 */
  U.favBtn = (c, size) => {
    const md = size === 'md';
    return `<button class="fav fav--${md ? 'md' : 'sm'}${c.favoritedByMe ? ' is-on' : ''}${c.mine ? ' is-mine' : ''}" type="button" data-fav="${c.id}" aria-pressed="${c.favoritedByMe}"
      aria-label="${c.favoritedByMe ? '取消收藏' : '收藏'}，已有 ${c.favoriteCount} 人收藏"${c.mine ? ' title="不能收藏自己的胶囊"' : ''}>
      <span class="fav__ic">${icon('heart')}</span>${md ? `<span class="fav__t">${c.favoritedByMe ? '已收藏' : '收藏'}</span>` : ''}<span class="fav__n">${fmt.num(c.favoriteCount)}</span></button>`;
  };

  /* 广场卡片：状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒会当场翻面 */
  U.card = (c, opt) => {
    const o = opt || {};
    const p = HT.palette(c.code);
    const href = c.inPlaza ? `#/plaza/${c.id}` : `#/c/${c.code}`;
    const now = Date.now();
    const body = c.isOpened
      ? `<p class="pc__excerpt">${esc(preview(c.content))}</p>`
      : `<div class="pc__cd">${icon('hourglass')}<span class="pc__time mono" data-cd="${c.openAt}">${HT.cdShort(c.openAt, now)}</span>后开启</div>
         <div class="pc__progress" title="从封存到开启，时间已经走过的比例"><span style="width:${Math.max(2, fmt.progress(c, now))}%"></span></div>`;
    return `<article class="pc ${c.isOpened ? 'is-opened' : 'is-locked'}" style="--glow:${p.glow};--i:${o.i || 0}" data-id="${c.id}">
      <a class="pc__link" href="${href}" aria-label="${esc(c.title)}，${c.isOpened ? '已开启' : '封存中'}"></a>
      <div class="pc__top">
        <div class="pc__art">${HT.capsuleArt(c.code, c.isOpened ? 'opened' : 'locked', 150)}</div>
        <div class="pc__badges">${HT.stateBadge(c)}${o.rank ? HT.badge('hot', 'fire', '热度 No.' + o.rank) : ''}${c.inPlaza ? '' : HT.badge('private', 'lock', '未公开')}</div>
      </div>
      <h3 class="pc__title">${esc(c.title)}</h3>
      <div class="pc__by">${HT.avatar(c.creator.avatarId)}<span class="pc__name">${esc(c.creator.nickname)}</span>${c.mine ? '<em class="me-tag">我</em>' : ''}<i></i>封存于 ${fmt.date(c.createdAt)}</div>
      <div class="pc__body">${body}</div>
      <div class="pc__foot">
        <span class="pc__when">${icon('calendar')}${fmt.dateTime(c.openAt)} ${c.isOpened ? '已开启' : '开启'}</span>
        ${HT.favBtn(c)}
      </div>
    </article>`;
  };

  U.cardSkeleton = (i) => `<div class="pc pc--skel" style="--i:${i}" aria-hidden="true">
      <i class="sk" style="width:150px;height:62px;border-radius:999px"></i><i class="sk" style="width:70%;height:22px;margin-top:30px"></i>
      <i class="sk" style="width:45%;height:13px;margin-top:12px"></i><i class="sk" style="width:100%;height:13px;margin-top:22px"></i>
      <i class="sk" style="width:82%;height:13px;margin-top:10px"></i><i class="sk" style="width:100%;height:13px;margin-top:30px"></i></div>`;

  /* 8 位码输入：8 个格子 + 一个盖在上面的透明原生输入框（负责键盘、粘贴、输入法） */
  U.codeInput = (size) => `<div class="code${size ? ' code--' + size : ''}" data-code-input>
      <input class="code__native" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" aria-label="8 位胶囊码">
      <div class="code__cells" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span class="code__cell${i === 4 ? ' has-gap' : ''}"></span>`).join('')}</div>
    </div>`;
  U.bindCodeInput = (root, opt) => {
    const o = opt || {};
    const input = $('.code__native', root);
    const cells = $$('.code__cell', root);
    const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    let prev = '';
    function paint() {
      const v = input.value;
      cells.forEach((c, i) => {
        const ch = v[i] || '';
        if (c.textContent !== ch) {
          c.textContent = ch;
          c.classList.toggle('is-filled', !!ch);
          if (ch && i >= prev.length - 1) { c.classList.remove('is-pop'); void c.offsetWidth; c.classList.add('is-pop'); }
        }
        c.classList.toggle('is-active', i === Math.min(v.length, 7));
      });
      root.classList.remove('is-error');
      prev = v;
      if (o.onChange) o.onChange(v);
    }
    input.addEventListener('input', (e) => {
      if (e.isComposing) return;
      const v = clean(input.value);
      if (v !== input.value) input.value = v;
      paint();
      if (v.length === 8 && o.onComplete) o.onComplete(v);
    });
    input.addEventListener('compositionend', () => { input.value = clean(input.value); paint(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && o.onEnter) { e.preventDefault(); o.onEnter(input.value); } });
    input.addEventListener('focus', () => { root.classList.add('is-focused'); input.setSelectionRange(input.value.length, input.value.length); });
    input.addEventListener('blur', () => root.classList.remove('is-focused'));
    paint();
    return {
      get value() { return input.value; },
      set(v) { input.value = clean(v); paint(); },
      focus() { input.focus({ preventScroll: true }); },
      error() { root.classList.add('is-error'); HT.shake(root); },
      setState(s) { root.classList.toggle('is-checking', s === 'checking'); root.classList.toggle('is-ok', s === 'ok'); },
      input,
    };
  };

  /* 翻牌倒计时：天 / 时 / 分 / 秒；某一位变了才重新挂载，从而重播「落下」的动画 */
  U.countdownHTML = () => `<div class="cd" role="timer">
      ${[['d', '天'], ['h', '时'], ['m', '分'], ['s', '秒']].map(([k, l], i) => `${i ? '<div class="cd__sep" aria-hidden="true">:</div>' : ''}<div class="cd__unit${k === 's' ? ' cd__unit--accent' : ''}"><div class="cd__digits" data-u="${k}"></div><div class="cd__label">${l}</div></div>`).join('')}
    </div>`;
  U.paintCountdown = (root, openAt, now) => {
    const c = fmt.cd(openAt, now);
    const vals = { d: String(c.d).padStart(2, '0'), h: pad2(c.h), m: pad2(c.m), s: pad2(c.s) };
    Object.keys(vals).forEach((k) => {
      const box = $(`[data-u="${k}"]`, root);
      if (!box) return;
      const v = vals[k];
      const spans = box.children;
      if (spans.length !== v.length) { box.innerHTML = Array.from(v).map((d) => `<span class="cd__digit">${d}</span>`).join(''); return; }
      Array.from(v).forEach((d, i) => {
        if (spans[i].textContent === d) return;
        const n = document.createElement('span');
        n.className = 'cd__digit';
        n.textContent = d;
        box.replaceChild(n, spans[i]);
      });
    });
    root.setAttribute('aria-label', `距离开启还有 ${c.d} 天 ${c.h} 小时 ${c.m} 分 ${c.s} 秒`);
    return c;
  };


  U.loginMark = () => `<div class="dlg__mark">${icon('heart')}</div>`;

})(window.HT);
