/* ============================================================
   皮肤「时笺」· 视觉部件
   挂在 HT.skin('paper').ui 上；切换到这套皮肤时并入 HT，
   所以页面里的 HT.card / HT.avatar 等调用，永远指向当前皮肤的实现
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon, pad2, clamp, sleep, reduced } = HT;
  const U = HT.skin('paper').ui;

  /* ---------------- 视觉部件 ---------------- */

  /* 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） */
  U.seal = (ch, variant, cls) => `<span class="seal seal--${variant || 'solid'}${cls ? ' ' + cls : ''}" aria-hidden="true">${ch}</span>`;

  /* 品牌标：一枚印，印文是信封的折口——也像指向十点十分的表针 */
  U.logo = (cls) => `<svg class="logo${cls ? ' ' + cls : ''}" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="var(--seal)"/><path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--seal-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="17" r="2.6" fill="var(--seal-ink)"/></svg>`;

  const avatarOf = (id) => HT.AVATARS.find((a) => a.id === id) || HT.AVATARS[0];
  U.avatarOf = avatarOf;
  U.avatar = (id, cls) => {
    const a = avatarOf(id);
    return `<span class="av${cls ? ' ' + cls : ''}" style="--av:${a.color}" aria-hidden="true"><svg viewBox="0 0 24 24">${a.glyph}</svg></span>`;
  };

  /* 邮票：头像 + 齿孔边 */
  U.stamp = (id, cls, label) => {
    const a = avatarOf(id);
    return `<span class="stamp${cls ? ' ' + cls : ''}" style="--av:${a.color}"><span class="stamp__in"><svg viewBox="0 0 24 24" aria-hidden="true">${a.glyph}</svg>${label === false ? '' : `<b>${a.name}</b>`}</span></span>`;
  };

  /* 邮戳 */
  let pmSeq = 0;
  U.postmark = ({ line1, line2, top, bottom, cls } = {}) => {
    const id = 'pm' + (++pmSeq);
    return `<svg class="pm${cls ? ' ' + cls : ''}" viewBox="0 0 172 120" aria-hidden="true">
      <defs><path id="${id}a" d="M16.5,60 a43.5,43.5 0 1,1 87,0"/><path id="${id}b" d="M9.5,60 a50.5,50.5 0 0,0 101,0"/></defs>
      <g class="pm__ring"><circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="37"/></g>
      <text class="pm__arc"><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${top || 'HELLOTIME · POST'}</textPath></text>
      <text class="pm__arc pm__arc--cn"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${bottom || '时 光 邮 局'}</textPath></text>
      <text class="pm__l1" x="60" y="59" text-anchor="middle">${line1 || ''}</text>
      <text class="pm__l2" x="60" y="74" text-anchor="middle">${line2 || ''}</text>
      <g class="pm__waves">${[34, 47, 60, 73, 86].map((y) => `<path d="M120 ${y}q6.5-5 13 0t13 0 13 0 13 0"/>`).join('')}</g>
    </svg>`;
  };

  /* 火漆：不规则的蜡滴轮廓由种子随机生成，保证每次形状一致 */
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function blobPath(cx, cy, r, n, jitter, seed) {
    const rnd = mulberry(seed);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + (rnd() - 0.5) * 2 * jitter);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    const f = (v) => v.toFixed(1);
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
    }
    return d + 'Z';
  }
  const WAX_OUT = blobPath(50, 50, 46, 18, 0.055, 21);
  const WAX_IN = blobPath(50, 50, 43.5, 14, 0.03, 8);
  U.wax = (ch, cls) => `<span class="wax${cls ? ' ' + cls : ''}" aria-hidden="true"><svg viewBox="0 0 100 100">
      <defs><radialGradient id="wax-g" cx="36%" cy="30%" r="78%"><stop offset="0" style="stop-color:var(--wax-hi)"/><stop offset=".5" style="stop-color:var(--wax)"/><stop offset="1" style="stop-color:var(--wax-lo)"/></radialGradient></defs>
      <path d="${WAX_OUT}" fill="var(--wax-lo)"/>
      <path d="${WAX_IN}" fill="url(#wax-g)"/>
      <circle cx="50" cy="50" r="30.5" fill="none" stroke="var(--wax-lo)" stroke-width="2.4" opacity=".5"/>
      <circle cx="50.7" cy="50.8" r="30.5" fill="none" stroke="var(--wax-hi)" stroke-width=".9" opacity=".55"/>
      <text class="wax__ch wax__ch--hi" x="50.9" y="51.1" text-anchor="middle" dy=".36em">${ch || '封'}</text>
      <text class="wax__ch" x="50" y="50" text-anchor="middle" dy=".36em">${ch || '封'}</text>
      <ellipse cx="35" cy="29" rx="15" ry="7.5" fill="#fff" opacity=".17" transform="rotate(-30 35 29)"/>
    </svg></span>`;

  /* 信封（封口面）：back 内衬 → letter 信纸 → front 口袋 → flap 封舌 → seal 火漆 */
  U.envelope = ({ cls, letter, seal } = {}) => `
    <div class="env${cls ? ' ' + cls : ''}">
      <div class="env__back"></div>
      <div class="env__letter">${letter || ''}</div>
      <div class="env__front"><svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
        <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z"/>
        <path class="env__shade" d="M1 2.2 50 38 99 2.2"/>
        <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9"/>
        <path class="env__edge" d="M0 0 50 36 100 0"/>
      </svg></div>
      <div class="env__flap"><i class="env__flap-f"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0"/></svg></i><i class="env__flap-b"></i></div>
      ${seal === false ? '' : `<div class="env__seal">${HT.wax('封')}</div>`}
    </div>`;

  /* 刻度尺：封存 → 启封 的等待进度 */
  U.scale = (p, cls) => `<div class="scale${cls ? ' ' + cls : ''}" style="--p:${p}%"><i class="scale__fill"></i><i class="scale__mark"></i></div>`;

  /* 倒计时（卡片用的短格式） */
  U.cdShort = (openAt, now) => {
    const c = fmt.cd(openAt, now);
    const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
    return c.d > 0 ? `<b class="latin">${fmt.num(c.d)}</b><small>天</small><span class="mono">${hms}</span>` : `<b class="mono cap__cd-hms">${hms}</b>`;
  };

  const preview = (text, n) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > (n || 78) ? t.slice(0, n || 78) + '……' : t; };
  U.preview = preview;

  /* 收藏按钮 */
  U.favBtn = (c, size) => {
    const md = size === 'md';
    return `<button class="fav fav--${md ? 'md' : 'sm'}${c.favoritedByMe ? ' is-on' : ''}" type="button" data-fav="${c.id}" aria-pressed="${c.favoritedByMe}"
      aria-label="${c.favoritedByMe ? '取消收藏' : '收藏'}，已有 ${c.favoriteCount} 人收藏">
      <span class="fav__ic">${icon('heart')}</span>${md ? `<span class="fav__t">${c.favoritedByMe ? '已收藏' : '收藏'}</span>` : ''}<span class="fav__n">${fmt.num(c.favoriteCount)}</span></button>`;
  };

  /* 卡片底图：同一只信封的两种状态——合着、舌尖钤朱印 / 封舌掀起、信纸露出半截 */
  const ENV_ART = {
    sealed: `<svg class="cap__art" viewBox="0 0 120 84" aria-hidden="true">
      <rect class="ea__body" x="2" y="6" width="116" height="76" rx="3"/>
      <path class="ea__line" d="M2.5 80.5 47 46M117.5 80.5 73 46"/>
      <path class="ea__flap" d="M3 7.5 60 48 117 7.5"/>
      <g class="ea__seal"><circle cx="60" cy="48" r="11"/><circle class="ea__seal-ring" cx="60" cy="48" r="7"/></g>
    </svg>`,
    opened: `<svg class="cap__art" viewBox="0 0 120 100" aria-hidden="true">
      <path class="ea__body" d="M2 42 60 4 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/>
      <rect class="ea__paper" x="16" y="14" width="88" height="62" rx="1.5"/>
      <path class="ea__rule" d="M26 30h68M26 40h68M26 50h68M26 60h44"/>
      <path class="ea__pocket" d="M2 42 60 78 118 42V96a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z"/>
      <path class="ea__line" d="M2.5 97.5 49 70M117.5 97.5 71 70"/>
    </svg>`,
  };

  /* 胶囊卡片：封 / 启两种形态 */
  U.card = (c, opt) => {
    const o = opt || {};
    const href = `#/capsules/${c.code}`;
    const now = Date.now();
    const body = c.isOpened
      ? `<p class="cap__preview">${esc(preview(c.content))}</p>
         <div class="cap__when"><span>启于 ${fmt.date(c.openAt)}</span><i></i><span>在途 ${fmt.span(c.openAt - c.createdAt)}</span></div>`
      : `<div class="cap__veil" aria-hidden="true"><i></i><i></i></div>
         <div class="cap__cd"><span class="cap__cd-label">距启封</span><span class="cap__cd-val" data-cd="${c.openAt}">${HT.cdShort(c.openAt, now)}</span></div>
         ${HT.scale(fmt.progress(c, now))}
         <div class="cap__ends mono"><span>${fmt.date(c.createdAt)}</span><span>${fmt.date(c.openAt)}</span></div>`;
    return `<article class="cap cap--${c.isOpened ? 'opened' : 'sealed'}" style="--i:${o.i || 0}" data-id="${c.id}">
      <div class="cap__bg" aria-hidden="true">${ENV_ART[c.isOpened ? 'opened' : 'sealed']}</div>
      <a class="cap__link" href="${href}" aria-label="${esc(c.title)}，${c.isOpened ? '已开启' : '未开启'}"></a>
      <header class="cap__top">
        ${HT.seal(c.isOpened ? '启' : '封', c.isOpened ? 'line' : 'solid')}
        <span class="cap__status">${c.isOpened ? '已开启' : '未开启'}</span>
        ${c.inPlaza ? '' : `<span class="cap__private" title="没有发布到广场，凭胶囊码可见">${icon('lock')}未公开</span>`}
        ${o.rank ? `<span class="cap__rank latin" title="热度第 ${o.rank}">No.${o.rank}</span>` : ''}
        <span class="cap__code mono">${c.code}</span>
      </header>
      <h3 class="cap__title">${esc(c.title)}</h3>
      ${body}
      <footer class="cap__foot">
        <span class="who">${HT.avatar(c.creator.avatarId)}<span class="who__n">${esc(c.creator.nickname)}</span>${c.mine ? '<em class="who__me">我</em>' : ''}</span>
        ${HT.favBtn(c)}
      </footer>
    </article>`;
  };

  /* 卡片骨架 */
  U.cardSkeleton = (i) => `<div class="cap cap--skel" style="--i:${i}" aria-hidden="true"><i class="sk sk--a"></i><i class="sk sk--b"></i><i class="sk sk--c"></i><i class="sk sk--c2"></i><i class="sk sk--d"></i></div>`;


  /* 登录提示框上的小标记 */
  U.loginMark = () => `<div class="dlg__mark">${HT.seal('藏', 'line')}</div>`;

})(window.HT);
