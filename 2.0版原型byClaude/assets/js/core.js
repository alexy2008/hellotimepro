/* ============================================================
   HelloTime Pro · 2.0 原型 · 核心
   状态（本地存储模拟后端）· 格式化 · 可复用的视觉部件
   ============================================================ */
(function (HT) {
  'use strict';

  const D = 86400000;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(HT, { $, $$, esc, pad2, sleep, clamp, reduced, DAY: D });

  /* ---------------- 本地存储 ---------------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('ht2.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ht2.' + k, JSON.stringify(v)); } catch (e) {} },
    clear() { try { Object.keys(localStorage).filter((k) => k.indexOf('ht2.') === 0 && k !== 'ht2.theme').forEach((k) => localStorage.removeItem(k)); } catch (e) {} },
  };
  HT.LS = LS;

  /* ---------------- 事件总线 ---------------- */
  const bus = {
    m: {},
    on(t, fn) { (this.m[t] = this.m[t] || new Set()).add(fn); return () => this.m[t].delete(fn); },
    emit(t, p) { (this.m[t] || []).forEach((fn) => { try { fn(p); } catch (e) { console.error(e); } }); },
  };
  HT.bus = bus;

  /* ---------------- 状态 ---------------- */
  let epoch = LS.get('epoch', 0);
  if (!epoch) { epoch = Date.now(); LS.set('epoch', epoch); }

  const state = {
    user: LS.get('user', null),
    extra: LS.get('extra', []),          // 用户新建的胶囊
    removed: LS.get('removed', []),      // 已撤回的 id
    favs: LS.get('favs', null),          // { capsuleId: favoritedAt }
    overrides: LS.get('overrides', {}),  // 原型「快进」用：{ id: { openAt } }
    accounts: LS.get('accounts', []),    // 原型里注册的账号
    backend: LS.get('backend', 'fastapi'),
    demo: { plaza: 'normal' },           // 原型导览里切换的演示状态
  };
  if (!state.favs) {
    state.favs = {};
    Object.keys(HT.SEED_FAVS).forEach((k) => { state.favs[k] = Math.round(epoch + HT.SEED_FAVS[k] * D); });
    LS.set('favs', state.favs);
  }
  HT.state = state;
  HT.epoch = () => epoch;

  function seedToCapsule(s) {
    const u = HT.USERS[s.by];
    const openAt = s.openAbs
      ? new Date(s.openAbs[0], s.openAbs[1] - 1, s.openAbs[2], s.openAbs[3], s.openAbs[4]).getTime()
      : Math.round(epoch + s.open * D);
    return {
      id: s.id, code: s.code, title: s.title, content: s.content, ownerId: u.id,
      creator: { nickname: u.nickname, avatarId: u.avatarId },
      createdAt: Math.round(epoch + s.created * D), openAt, inPlaza: s.plaza, baseFav: s.fav,
    };
  }

  function decorate(c) {
    const ov = state.overrides[c.id];
    const openAt = ov && ov.openAt ? ov.openAt : c.openAt;
    const me = state.user;
    const mine = !!me && c.ownerId === me.id;
    const fav = !!me && !!state.favs[c.id];
    return Object.assign({}, c, {
      openAt, mine,
      creator: mine ? { nickname: me.nickname, avatarId: me.avatarId } : c.creator,
      isOpened: openAt <= Date.now(),
      favoritedByMe: fav,
      favoritedAt: fav ? state.favs[c.id] : null,
      favoriteCount: (c.baseFav || 0) + (state.favs[c.id] ? 1 : 0),
    });
  }

  function all() {
    return HT.SEEDS.map(seedToCapsule).concat(state.extra)
      .filter((c) => state.removed.indexOf(c.id) < 0)
      .map(decorate);
  }

  function randomCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  class ApiError extends Error {
    constructor(message, code, field) { super(message); this.code = code; this.field = field; }
  }

  /* ---------------- 模拟 API（形状对齐 openapi.yaml） ---------------- */
  const api = {
    ApiError,

    plaza({ sort = 'new', filter = 'all', q = '', page = 1, pageSize = 9 } = {}) {
      const kw = q.trim().toLowerCase();
      let list = all().filter((c) => c.inPlaza);
      const counts = { all: list.length, opened: list.filter((c) => c.isOpened).length };
      counts.unopened = counts.all - counts.opened;
      if (filter === 'opened') list = list.filter((c) => c.isOpened);
      if (filter === 'unopened') list = list.filter((c) => !c.isOpened);
      if (kw) list = list.filter((c) => c.title.toLowerCase().indexOf(kw) >= 0 || c.creator.nickname.toLowerCase().indexOf(kw) >= 0);
      list.sort(sort === 'hot'
        ? (a, b) => b.favoriteCount - a.favoriteCount || b.createdAt - a.createdAt
        : (a, b) => b.createdAt - a.createdAt);
      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const p = clamp(page, 1, totalPages);
      return { items: list.slice((p - 1) * pageSize, p * pageSize), pagination: { page: p, pageSize, total, totalPages }, counts };
    },

    stats() {
      const list = all().filter((c) => c.inPlaza);
      const sealed = list.filter((c) => !c.isOpened);
      const farthest = sealed.reduce((m, c) => Math.max(m, c.openAt), 0);
      return { total: list.length, sealed: sealed.length, opened: list.length - sealed.length, farthest };
    },

    featured() {
      return all().filter((c) => c.inPlaza && !c.isOpened).sort((a, b) => b.favoriteCount - a.favoriteCount)[0] || null;
    },

    byCode(code) {
      return all().find((c) => c.code === String(code || '').toUpperCase()) || null;
    },

    byId(id, includePrivate) {
      const c = all().find((x) => x.id === id) || null;
      return c && (c.inPlaza || includePrivate) ? c : null;
    },

    create({ title, content, openAt, inPlaza }) {
      const me = state.user;
      if (!me) throw new ApiError('请先登录', 'UNAUTHORIZED');
      const c = {
        id: 'n' + Date.now().toString(36), code: randomCode(), title: title.trim(), content,
        ownerId: me.id, creator: { nickname: me.nickname, avatarId: me.avatarId },
        createdAt: Date.now(), openAt, inPlaza: !!inPlaza, baseFav: 0,
      };
      state.extra.unshift(c);
      LS.set('extra', state.extra);
      bus.emit('data');
      return decorate(c);
    },

    toggleFav(id) {
      const c = api.byId(id, true);
      if (!c) throw new ApiError('胶囊不存在', 'NOT_FOUND');
      if (state.favs[id]) delete state.favs[id]; else state.favs[id] = Date.now();
      LS.set('favs', state.favs);
      const n = api.byId(id, true);
      return { favorited: !!state.favs[id], favoriteCount: n.favoriteCount };
    },

    mine() {
      const me = state.user;
      return me ? all().filter((c) => c.ownerId === me.id).sort((a, b) => b.createdAt - a.createdAt) : [];
    },

    favorites() {
      return all().filter((c) => c.favoritedByMe && c.inPlaza).sort((a, b) => b.favoritedAt - a.favoritedAt);
    },

    remove(id) {
      state.removed.push(id);
      LS.set('removed', state.removed);
      if (state.favs[id]) { delete state.favs[id]; LS.set('favs', state.favs); }
      bus.emit('data');
    },

    /* —— 账号 —— */
    nicknameTaken(name, exceptId) {
      const n = name.trim();
      const seed = Object.keys(HT.USERS).some((k) => HT.USERS[k].nickname === n && HT.USERS[k].id !== exceptId);
      return seed || state.accounts.some((a) => a.nickname === n && a.id !== exceptId);
    },
    emailTaken(email) {
      const e = email.trim().toLowerCase();
      return e === HT.DEMO_ACCOUNT.email || state.accounts.some((a) => a.email === e);
    },
    login(email, password) {
      const e = email.trim().toLowerCase();
      let user = null;
      if (e === HT.DEMO_ACCOUNT.email && password === HT.DEMO_ACCOUNT.password) {
        const saved = LS.get('demoProfile', null);
        const u = HT.USERS[HT.DEMO_ACCOUNT.userKey];
        user = Object.assign({ id: u.id, email: e, nickname: u.nickname, avatarId: u.avatarId, createdAt: Math.round(epoch - HT.DEMO_ACCOUNT.joinedDaysAgo * D) }, saved || {});
      } else {
        const a = state.accounts.find((x) => x.email === e && x.password === password);
        if (a) user = { id: a.id, email: a.email, nickname: a.nickname, avatarId: a.avatarId, createdAt: a.createdAt };
      }
      if (!user) throw new ApiError('邮箱或密码不正确', 'UNAUTHORIZED');
      state.user = user; LS.set('user', user); bus.emit('auth');
      return user;
    },
    loginDemo() { return api.login(HT.DEMO_ACCOUNT.email, HT.DEMO_ACCOUNT.password); },
    register({ email, password, nickname, avatarId }) {
      const e = email.trim().toLowerCase();
      if (api.emailTaken(e)) throw new ApiError('这个邮箱已经注册过了', 'VALIDATION_ERROR', 'email');
      if (api.nicknameTaken(nickname)) throw new ApiError('这个昵称已经有人用了', 'VALIDATION_ERROR', 'nickname');
      const a = { id: 'u-' + Date.now().toString(36), email: e, password, nickname: nickname.trim(), avatarId, createdAt: Date.now() };
      state.accounts.push(a); LS.set('accounts', state.accounts);
      const user = { id: a.id, email: a.email, nickname: a.nickname, avatarId: a.avatarId, createdAt: a.createdAt };
      state.user = user; LS.set('user', user); bus.emit('auth');
      return user;
    },
    logout() { state.user = null; LS.set('user', null); bus.emit('auth'); },
    updateProfile(patch) {
      const me = state.user;
      if (patch.nickname != null && api.nicknameTaken(patch.nickname, me.id)) throw new ApiError('这个昵称已经有人用了', 'VALIDATION_ERROR', 'nickname');
      Object.assign(me, patch);
      LS.set('user', me);
      if (me.id === HT.USERS[HT.DEMO_ACCOUNT.userKey].id) LS.set('demoProfile', { nickname: me.nickname, avatarId: me.avatarId });
      const acc = state.accounts.find((a) => a.id === me.id);
      if (acc) { Object.assign(acc, patch); LS.set('accounts', state.accounts); }
      state.extra.forEach((c) => { if (c.ownerId === me.id) c.creator = { nickname: me.nickname, avatarId: me.avatarId }; });
      LS.set('extra', state.extra);
      bus.emit('auth');
      return me;
    },
    changePassword(current, next) {
      const me = state.user;
      const acc = state.accounts.find((a) => a.id === me.id);
      const ok = acc ? acc.password === current : current === HT.DEMO_ACCOUNT.password;
      if (!ok) throw new ApiError('当前密码不正确', 'UNAUTHORIZED', 'current');
      if (acc) { acc.password = next; LS.set('accounts', state.accounts); }
    },

    /* —— 技术栈（GET /health） —— */
    health() {
      const b = HT.BACKENDS.find((x) => x.key === state.backend) || HT.BACKENDS[1];
      return { status: 'ok', backend: b, frontend: HT.FRONTEND_STACK };
    },
    setBackend(key) { state.backend = key; LS.set('backend', key); bus.emit('backend'); },

    /* —— 原型专用 —— */
    fastForward(id, inMs) {
      state.overrides[id] = { openAt: Date.now() + (inMs || 4200) };
      LS.set('overrides', state.overrides);
    },
    resetAll() { LS.clear(); location.hash = '#/'; location.reload(); },
  };
  HT.api = api;

  /* ---------------- 格式化 ---------------- */
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const LUNAR_MONTH = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  function lunarDay(n) {
    if (n <= 10) return '初' + CN_NUM[n];
    if (n < 20) return '十' + CN_NUM[n - 10];
    if (n === 20) return '二十';
    if (n < 30) return '廿' + CN_NUM[n - 20];
    return '三十';
  }

  const fmt = {
    date(ms) { const d = new Date(ms); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; },
    time(ms, sec) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? ':' + pad2(d.getSeconds()) : ''}`; },
    dateTime(ms) { return fmt.date(ms) + ' ' + fmt.time(ms); },
    cn(ms) { const d = new Date(ms); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; },
    week(ms) { return '星期' + WEEK[new Date(ms).getDay()]; },
    full(ms) { return `${fmt.cn(ms)} ${fmt.week(ms)} ${fmt.time(ms)}`; },
    num(n) { return Number(n).toLocaleString('zh-CN'); },
    lunar(ms) {
      try {
        const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', month: 'long', day: 'numeric' }).formatToParts(new Date(ms));
        const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
        const year = get('yearName');
        let month = get('month');
        let day = get('day');
        if (/^\d+$/.test(month)) month = LUNAR_MONTH[+month - 1];
        if (month && !/月$/.test(month)) month += '月';
        if (/^\d+$/.test(day)) day = lunarDay(+day);
        return (year ? year + '年' : '') + month + day;
      } catch (e) { return ''; }
    },
    /* 把一段时长说成人话：3 分钟 / 5 小时 / 12 天 / 7 个月 / 2 年 8 个月 */
    span(ms) {
      const m = Math.max(0, Math.round(ms / 60000));
      if (m < 1) return '不到 1 分钟';
      if (m < 60) return m + ' 分钟';
      if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return r && h < 6 ? `${h} 小时 ${r} 分` : `${Math.round(m / 60)} 小时`; }
      const days = Math.round(m / 1440);
      if (days < 60) return days + ' 天';
      if (days < 360) return Math.round(days / 30.44) + ' 个月';
      let y = Math.floor(days / 365.25);
      let mo = Math.round((days - y * 365.25) / 30.44);
      if (mo >= 12) { y += 1; mo = 0; }
      if (y === 0) return '1 年';
      return mo ? `${y} 年 ${mo} 个月` : `${y} 年`;
    },
    cd(openAt, now) {
      const t = Math.max(0, Math.floor((openAt - (now || Date.now())) / 1000));
      return { expired: openAt <= (now || Date.now()), total: t, d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
    },
    /* 等待进度：封存 → 启封 走了百分之几 */
    progress(c, now) {
      const span = c.openAt - c.createdAt;
      if (span <= 0) return 100;
      return clamp(Math.round(((now || Date.now()) - c.createdAt) / span * 100), 0, 100);
    },
  };
  HT.fmt = fmt;

  /* ---------------- 图标（24 网格 · 1.6 线宽） ---------------- */
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
    key: '<circle cx="7.5" cy="16.5" r="4"/><path d="M10.4 13.6 20 4M17 7l2.5 2.5M14.2 9.8l2 2"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'chev-down': '<path d="m6 9 6 6 6-6"/>',
    'chev-left': '<path d="m15 6-6 6 6 6"/>',
    'chev-right': '<path d="m9 6 6 6-6 6"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
    logout: '<path d="M10 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h4"/><path d="M10 12h9.5M16 8l4 4-4 4"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    pen: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z"/><path d="m14.5 6 3 3"/>',
    sparkle: '<path d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4L20.5 12 15 13.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9L12 3.5z"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.5v4h-4M6 20.5v-4h4"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 10.5v6M14 10.5v6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
    alert: '<path d="M12 4 21 19.5H3L12 4z"/><path d="M12 10v4.5M12 17v.2"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 6.5 8 6.5 8-6.5"/>',
    grid: '<path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z"/>',
    paste: '<rect x="6" y="5" width="12" height="15.5" rx="1.5"/><path d="M9.5 5V3.5h5V5M9 10h6M9 13.5h6M9 17h3.5"/>',
    external: '<path d="M13 5h6v6M19 5l-8.5 8.5M10 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V14"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    fire: '<path d="M12 21c3.6 0 6.5-2.6 6.5-6.3 0-4.2-3.4-5.7-3.8-9.7-2.2 1-3.9 3.2-4 5.6-1-.6-1.6-1.7-1.7-2.8C7 9.3 5.5 11.7 5.5 14.7 5.5 18.4 8.4 21 12 21z"/>',
    book: '<path d="M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5h11"/>',
  };
  const icon = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  HT.icon = icon;

  /* ---------------- 视觉部件 ---------------- */

  /* 印章：solid = 白文（朱底白字，表示「封」）；line = 朱文（朱框朱字，表示「启」） */
  HT.seal = (ch, variant, cls) => `<span class="seal seal--${variant || 'solid'}${cls ? ' ' + cls : ''}" aria-hidden="true">${ch}</span>`;

  /* 品牌标：一枚印，印文是信封的折口——也像指向十点十分的表针 */
  HT.logo = (cls) => `<svg class="logo${cls ? ' ' + cls : ''}" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="6" fill="var(--seal)"/><path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--seal-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="17" r="2.6" fill="var(--seal-ink)"/></svg>`;

  const avatarOf = (id) => HT.AVATARS.find((a) => a.id === id) || HT.AVATARS[0];
  HT.avatarOf = avatarOf;
  HT.avatar = (id, cls) => {
    const a = avatarOf(id);
    return `<span class="av${cls ? ' ' + cls : ''}" style="--av:${a.color}" aria-hidden="true"><svg viewBox="0 0 24 24">${a.glyph}</svg></span>`;
  };

  /* 邮票：头像 + 齿孔边 */
  HT.stamp = (id, cls, label) => {
    const a = avatarOf(id);
    return `<span class="stamp${cls ? ' ' + cls : ''}" style="--av:${a.color}"><span class="stamp__in"><svg viewBox="0 0 24 24" aria-hidden="true">${a.glyph}</svg>${label === false ? '' : `<b>${a.name}</b>`}</span></span>`;
  };

  /* 邮戳 */
  let pmSeq = 0;
  HT.postmark = ({ line1, line2, top, bottom, cls } = {}) => {
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
  HT.wax = (ch, cls) => `<span class="wax${cls ? ' ' + cls : ''}" aria-hidden="true"><svg viewBox="0 0 100 100">
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
  HT.envelope = ({ cls, letter, seal } = {}) => `
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
  HT.scale = (p, cls) => `<div class="scale${cls ? ' ' + cls : ''}" style="--p:${p}%"><i class="scale__fill"></i><i class="scale__mark"></i></div>`;

  /* 倒计时（卡片用的短格式） */
  HT.cdShort = (openAt, now) => {
    const c = fmt.cd(openAt, now);
    const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
    return c.d > 0 ? `<b class="latin">${fmt.num(c.d)}</b><small>天</small><span class="mono">${hms}</span>` : `<b class="mono cap__cd-hms">${hms}</b>`;
  };

  const preview = (text, n) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > (n || 78) ? t.slice(0, n || 78) + '……' : t; };
  HT.preview = preview;

  /* 收藏按钮 */
  HT.favBtn = (c, size) => {
    const md = size === 'md';
    return `<button class="fav fav--${md ? 'md' : 'sm'}${c.favoritedByMe ? ' is-on' : ''}${c.mine ? ' is-mine' : ''}" type="button" data-fav="${c.id}" aria-pressed="${c.favoritedByMe}"
      aria-label="${c.favoritedByMe ? '取消收藏' : '收藏'}，已有 ${c.favoriteCount} 人收藏"${c.mine ? ' title="不能收藏自己的胶囊"' : ''}>
      <span class="fav__ic">${icon('heart')}</span>${md ? `<span class="fav__t">${c.favoritedByMe ? '已收藏' : '收藏'}</span>` : ''}<span class="fav__n">${fmt.num(c.favoriteCount)}</span></button>`;
  };

  /* 胶囊卡片：封 / 启两种形态 */
  HT.card = (c, opt) => {
    const o = opt || {};
    const href = c.inPlaza ? `#/plaza/${c.id}` : `#/c/${c.code}`;
    const now = Date.now();
    const body = c.isOpened
      ? `<p class="cap__preview">${esc(preview(c.content))}</p>
         <div class="cap__when"><span>启于 ${fmt.date(c.openAt)}</span><i></i><span>在途 ${fmt.span(c.openAt - c.createdAt)}</span></div>`
      : `<div class="cap__veil" aria-hidden="true"><i></i><i></i><i></i></div>
         <div class="cap__cd"><span class="cap__cd-label">距启封</span><span class="cap__cd-val" data-cd="${c.openAt}">${HT.cdShort(c.openAt, now)}</span></div>
         ${HT.scale(fmt.progress(c, now))}
         <div class="cap__ends mono"><span>${fmt.date(c.createdAt)}</span><span>${fmt.date(c.openAt)}</span></div>`;
    return `<article class="cap cap--${c.isOpened ? 'opened' : 'sealed'}" style="--i:${o.i || 0}" data-id="${c.id}">
      <a class="cap__link" href="${href}" aria-label="${esc(c.title)}，${c.isOpened ? '已开启' : '未开启'}"></a>
      <header class="cap__top">
        ${HT.seal(c.isOpened ? '启' : '封', c.isOpened ? 'line' : 'solid')}
        <span class="cap__status">${c.isOpened ? '已开启' : '未开启'}</span>
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
  HT.cardSkeleton = (i) => `<div class="cap cap--skel" style="--i:${i}" aria-hidden="true"><i class="sk sk--a"></i><i class="sk sk--b"></i><i class="sk sk--c"></i><i class="sk sk--c2"></i><i class="sk sk--d"></i></div>`;

  /* ---------------- 交互小件 ---------------- */

  HT.toast = function (msg, opt) {
    const o = opt || {};
    const type = o.type || 'ok';
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.innerHTML = `${icon(type === 'err' ? 'alert' : type === 'info' ? 'info' : 'check')}<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 400); }, o.ms || 2600);
  };

  HT.dialog = function ({ title, body, confirm, cancel, tone, mark }) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'dlg';
      el.innerHTML = `<div class="dlg__scrim" data-x></div>
        <div class="dlg__card" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
          ${mark || ''}
          <h2 id="dlg-t" class="dlg__t">${title}</h2>
          <div class="dlg__b">${body || ''}</div>
          <div class="dlg__act">
            <button class="btn btn--ghost" type="button" data-x>${cancel || '取消'}</button>
            <button class="btn btn--${tone || 'primary'}" type="button" data-ok>${confirm || '确定'}</button>
          </div>
        </div>`;
      $('#overlay').appendChild(el);
      const prev = document.activeElement;
      let done = false;
      const close = (v) => {
        if (done) return; done = true;
        el.classList.remove('is-in');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => el.remove(), 240);
        if (prev && prev.focus) prev.focus();
        resolve(v);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(false); };
      el.addEventListener('click', (e) => { if (e.target.closest('[data-ok]')) close(true); else if (e.target.closest('[data-x]')) close(false); });
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('is-in'); $('[data-ok]', el).focus(); }));
    });
  };

  HT.copy = async function (text, okMsg) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;left:-99px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) {}
      ta.remove();
    }
    if (okMsg) HT.toast(okMsg);
  };

  /* 每秒一跳的全局节拍：页面切换时由路由统一清空 */
  const tick = {
    fns: new Set(),
    on(fn) { this.fns.add(fn); return () => this.fns.delete(fn); },
    clear() { this.fns.clear(); },
  };
  (function loop() {
    setTimeout(() => {
      const now = Date.now();
      tick.fns.forEach((fn) => { try { fn(now); } catch (e) { console.error(e); } });
      loop();
    }, 1000 - (Date.now() % 1000) + 4);
  })();
  HT.tick = tick;

  /* 数字滚动：逐位比较，只有变了的那一位向上翻 */
  HT.setDigits = function (el, str) {
    const cells = el.children;
    if (cells.length !== str.length) {
      el.innerHTML = Array.from(str).map((ch) => `<span class="dg" data-v="${ch}"><span class="dg__cur">${ch}</span></span>`).join('');
      return;
    }
    Array.from(str).forEach((ch, i) => {
      const cell = cells[i];
      if (cell.dataset.v === ch) return;
      cell.dataset.v = ch;
      $$('.dg__out', cell).forEach((n) => n.remove());
      const old = $('.dg__cur', cell);
      if (old) { old.className = 'dg__out'; setTimeout(() => old.remove(), 520); }
      const neu = document.createElement('span');
      neu.className = 'dg__cur dg__in';
      neu.textContent = ch;
      cell.appendChild(neu);
    });
  };

  /* 分段选择：滑块跟着选中项走 */
  HT.seg = function (root, onChange) {
    const thumb = $('.seg__thumb', root);
    const place = (animate) => {
      const a = $('.seg__opt.is-active', root);
      if (!a || !thumb) return;
      if (!animate) thumb.style.transition = 'none';
      thumb.style.width = a.offsetWidth + 'px';
      thumb.style.transform = `translateX(${a.offsetLeft}px)`;
      if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; }
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.seg__opt');
      if (!b || b.classList.contains('is-active')) return;
      $$('.seg__opt', root).forEach((o) => { o.classList.toggle('is-active', o === b); o.setAttribute('aria-pressed', String(o === b)); });
      place(true);
      onChange(b.dataset.val);
    });
    place(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(false));
    return { place };
  };

  /* 收藏时的小烟花 */
  HT.burst = function (host) {
    if (reduced() || !host) return;
    const b = document.createElement('span');
    b.className = 'burst';
    b.innerHTML = Array.from({ length: 7 }, (_, i) => `<i style="--a:${Math.round(i * 51.4 - 90)}deg;--d:${15 + (i % 3) * 5}px"></i>`).join('');
    host.appendChild(b);
    setTimeout(() => b.remove(), 720);
  };

  /* 抖一下：校验不通过时的轻提示 */
  HT.shake = function (el) {
    if (!el) return;
    el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
    setTimeout(() => el.classList.remove('is-shake'), 480);
  };

  HT.go = (path) => { location.hash = '#' + path; };

  HT.askLogin = async function (title) {
    const ok = await HT.dialog({
      title: title || '登录后继续',
      body: '<p>收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。</p>',
      confirm: '去登录', cancel: '再逛逛',
      mark: `<div class="dlg__mark">${HT.seal('藏', 'line')}</div>`,
    });
    if (ok) HT.go('/login?redirect=' + encodeURIComponent(HT.route ? HT.route.path : '/'));
  };
})(window.HT = window.HT || {});
