/* ============================================================
 * HelloTime Pro Laravel 全栈 · 前端核心层（2.0）
 * - HT.fmt：时间说法、倒计时、等待进度、日历年加法、农历、专属色
 * - HT.api：同源 fetch 封装、统一响应解包、401 单飞刷新并重放（cookie 会话）
 * - Alpine.store：ui（双皮肤 + 柔光转场 + 明暗晕开）、auth、clock、feedback
 * - HT.startSky：琥珀星空 / 晨曦微尘画布
 * ============================================================ */
(function () {
  "use strict";

  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  const LUNAR_MONTH = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
  const CN_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

  function lunarDay(n) {
    if (n <= 10) return "初" + CN_NUM[n];
    if (n < 20) return "十" + CN_NUM[n - 10];
    if (n === 20) return "二十";
    if (n < 30) return "廿" + CN_NUM[n - 20];
    return "三十";
  }

  const ms = (v) => (typeof v === "number" ? v : new Date(v).getTime());
  const pad2 = (n) => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const charLen = (s) => Array.from(String(s ?? "")).length;

  const fmt = {
    ms,
    pad2,
    clamp,
    charLen,
    date(t) {
      const d = new Date(t);
      return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
    },
    time(t, sec = false) {
      const d = new Date(t);
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? ":" + pad2(d.getSeconds()) : ""}`;
    },
    dateTime(t) {
      return fmt.date(t) + " " + fmt.time(t);
    },
    dashDateTime(t) {
      return fmt.dateTime(t).replace(/\./g, "-");
    },
    cn(t) {
      const d = new Date(t);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    },
    week(t) {
      return "星期" + WEEK[new Date(t).getDay()];
    },
    full(t) {
      return `${fmt.cn(t)} ${fmt.week(t)} ${fmt.time(t)}`;
    },
    num(n) {
      return Number(n ?? 0).toLocaleString("zh-CN");
    },
    lunar(t) {
      try {
        const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }).formatToParts(new Date(t));
        const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
        const year = get("yearName");
        let month = get("month");
        let day = get("day");
        if (/^\d+$/.test(month)) month = LUNAR_MONTH[+month - 1];
        if (month && !/月$/.test(month)) month += "月";
        if (/^\d+$/.test(day)) day = lunarDay(+day);
        return (year ? year + "年" : "") + month + day;
      } catch {
        return "";
      }
    },
    span(t) {
      const m = Math.max(0, Math.round(t / 60000));
      if (m < 1) return "不到 1 分钟";
      if (m < 60) return m + " 分钟";
      if (m < 1440) {
        const h = Math.floor(m / 60);
        const r = m % 60;
        return r && h < 6 ? `${h} 小时 ${r} 分` : `${Math.round(m / 60)} 小时`;
      }
      const days = Math.round(m / 1440);
      if (days < 60) return days + " 天";
      if (days < 360) return Math.round(days / 30.44) + " 个月";
      let y = Math.floor(days / 365.25);
      let mo = Math.round((days - y * 365.25) / 30.44);
      if (mo >= 12) {
        y += 1;
        mo = 0;
      }
      if (y === 0) return "1 年";
      return mo ? `${y} 年 ${mo} 个月` : `${y} 年`;
    },
    cd(openAt, now = Date.now()) {
      const t = Math.max(0, Math.floor((openAt - now) / 1000));
      return {
        expired: openAt <= now,
        total: t,
        d: Math.floor(t / 86400),
        h: Math.floor((t % 86400) / 3600),
        m: Math.floor((t % 3600) / 60),
        s: t % 60,
      };
    },
    cdAmber(openAt, now = Date.now()) {
      const c = fmt.cd(openAt, now);
      const hms = `${pad2(c.h)}:${pad2(c.m)}:${pad2(c.s)}`;
      return c.d > 0 ? `${fmt.num(c.d)} 天 ${hms}` : hms;
    },
    progress(createdAt, openAt, now = Date.now()) {
      const span = openAt - createdAt;
      if (span <= 0) return 100;
      return clamp(Math.round(((now - createdAt) / span) * 100), 0, 100);
    },
    preview(text, n = 78) {
      const t = String(text ?? "").replace(/\s+/g, " ").trim();
      return t.length > n ? t.slice(0, n) + "……" : t;
    },
    paragraphs(text) {
      return String(text ?? "")
        .split(/\n{2,}/)
        .filter((p) => p.trim());
    },
    addCalendarYears(t, n) {
      const d = new Date(t);
      const out = new Date(t);
      out.setUTCFullYear(d.getUTCFullYear() + n);
      if (out.getUTCMonth() !== d.getUTCMonth()) out.setUTCDate(0);
      return out.getTime();
    },
    reducedMotion() {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    },
    sleep(t) {
      return new Promise((r) => setTimeout(r, t));
    },
    focusIfIdle(el) {
      const a = document.activeElement;
      if (el && (!a || a === document.body)) el.focus({ preventScroll: true });
    },
    safeRedirect(raw, fallback = "/") {
      if (!raw || typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
        return fallback;
      }
      return raw;
    },
    loginPath(from) {
      return `/login?redirect=${encodeURIComponent(from)}`;
    },
  };

  /* ---------------- 胶囊专属色（琥珀）：FNV-1a + OKLCH ---------------- */
  function fnv1a(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  function fromHue(hue, hue2) {
    return {
      hue,
      capLight: `oklch(0.84 0.14 ${hue})`,
      capDeep: `oklch(0.63 0.19 ${hue})`,
      accent: `oklch(0.78 0.13 ${hue2})`,
      glow: `oklch(0.72 0.17 ${hue} / 0.34)`,
    };
  }
  const BRAND_PALETTE = fromHue(68, 300);
  function paletteOf(code) {
    if (!code) return BRAND_PALETTE;
    const h = fnv1a(String(code));
    const hue = h % 360;
    return fromHue(hue, (hue + 40 + ((h >>> 9) % 41)) % 360);
  }

  /* ---------------- 头像目录（服务端直出 v2 徽记） ---------------- */
  function avatarOf(id) {
    const list = window.__HT_AVATARS__ || [];
    return list.find((a) => a.id === id) || list[0] || { id: "neo", name: "新生", tagline: "破土的芽", color: "#4a7c59", glyph: "" };
  }

  function avatarHtml(id, extraClass = "") {
    const a = avatarOf(id);
    const cls = extraClass ? `av ${extraClass}` : "av";
    return `<span class="${cls}" style="--av:${a.color}" aria-hidden="true"><svg viewBox="0 0 24 24">${a.glyph}</svg></span>`;
  }

  function avatarStampHtml(id, extraClass = "", showLabel = true) {
    const a = avatarOf(id);
    const cls = extraClass ? `stamp ${extraClass}` : "stamp";
    return `<span class="${cls}" style="--av:${a.color}"><span class="stamp__in"><svg viewBox="0 0 24 24" aria-hidden="true">${a.glyph}</svg>${showLabel ? `<b>${a.name}</b>` : ""}</span></span>`;
  }

  /* ---------------- 胶囊插画（琥珀，动态唯一 gradient ID） ---------------- */
  let artSeq = 0;
  function capsuleArtSvg(code, state = "locked", width = 200, extraClass = "") {
    const p = paletteOf(code);
    const id = `ca${++artSeq}`;
    const cls = `cart cart--${state}${extraClass ? " " + extraClass : ""}`;
    return `<svg class="${cls}" width="${width}" height="${width / 2}" viewBox="0 0 240 120" style="--cap-glow:${p.glow}" aria-hidden="true">`
      + `<defs>`
      + `<linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.capLight}"/><stop offset="1" stop-color="${p.capDeep}"/></linearGradient>`
      + `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="${p.accent}" stop-opacity=".42"/></linearGradient>`
      + `</defs>`
      + `<ellipse class="cart__shadow" cx="120" cy="107" rx="74" ry="6"/>`
      + `<g class="cart__paper"><rect x="98" y="24" width="44" height="62" rx="5"/><path d="M106 40h28M106 50h28M106 60h17"/></g>`
      + `<g class="cart__cap"><path d="M120 30H60a30 30 0 0 0 0 60h60Z" fill="url(#${id}c)"/><path class="cart__groove" d="M104 31v58M111 31v58"/><path class="cart__shine" d="M60 41h36"/></g>`
      + `<g class="cart__body"><path class="cart__glass" d="M120 30h60a30 30 0 0 1 0 60h-60Z" fill="url(#${id}g)"/><rect class="cart__scroll" x="133" y="46" width="46" height="28" rx="6"/><path class="cart__scroll-line" d="M141 56h30M141 64h19"/><path class="cart__shine" d="M132 40h40"/></g>`
      + `<rect class="cart__seam" x="115.5" y="27" width="9" height="66" rx="4.5"/>`
      + `<circle class="cart__lock" cx="120" cy="60" r="4.5"/>`
      + `</svg>`;
  }

  /* ---------------- 线性图标 ---------------- */
  function iconSvg(name, extraClass = "") {
    const paths = (window.__HT_ICONS__ || {})[name] || "";
    const cls = extraClass ? `ic ${extraClass}` : "ic";
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  }

  /* ---------------- 时笺火漆（不规则蜡滴，与 React 原型同种子） ---------------- */
  function mulberry(a) {
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
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
    return d + "Z";
  }
  const WAX_OUT = blobPath(50, 50, 46, 18, 0.055, 21);
  const WAX_IN = blobPath(50, 50, 43.5, 14, 0.03, 8);
  let waxSeq = 0;
  function waxHtml(ch = "封", extraClass = "") {
    const g = `wax-${++waxSeq}`;
    const cls = extraClass ? `wax ${extraClass}` : "wax";
    return `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 100 100">`
      + `<defs><radialGradient id="${g}" cx="36%" cy="30%" r="78%"><stop offset="0" style="stop-color:var(--wax-hi)"/><stop offset=".5" style="stop-color:var(--wax)"/><stop offset="1" style="stop-color:var(--wax-lo)"/></radialGradient></defs>`
      + `<path d="${WAX_OUT}" fill="var(--wax-lo)"/><path d="${WAX_IN}" fill="url(#${g})"/>`
      + `<circle cx="50" cy="50" r="30.5" fill="none" stroke="var(--wax-lo)" stroke-width="2.4" opacity=".5"/>`
      + `<circle cx="50.7" cy="50.8" r="30.5" fill="none" stroke="var(--wax-hi)" stroke-width=".9" opacity=".55"/>`
      + `<text class="wax__ch wax__ch--hi" x="50.9" y="51.1" text-anchor="middle" dy=".36em">${ch}</text>`
      + `<text class="wax__ch" x="50" y="50" text-anchor="middle" dy=".36em">${ch}</text>`
      + `<ellipse cx="35" cy="29" rx="15" ry="7.5" fill="#fff" opacity=".17" transform="rotate(-30 35 29)"/>`
      + `</svg></span>`;
  }

  let pmSeq = 0;
  function postmarkSvg(line1 = "", line2 = "", extraClass = "", top = "HELLOTIME · POST", bottom = "时 光 邮 局") {
    const id = `pm${++pmSeq}`;
    const cls = extraClass ? `pm ${extraClass}` : "pm";
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const waves = [34, 47, 60, 73, 86].map((y) => `<path d="M120 ${y}q6.5-5 13 0t13 0 13 0 13 0"/>`).join("");
    return `<svg class="${cls}" viewBox="0 0 172 120" aria-hidden="true">`
      + `<defs><path id="${id}a" d="M16.5,60 a43.5,43.5 0 1,1 87,0"/><path id="${id}b" d="M9.5,60 a50.5,50.5 0 0,0 101,0"/></defs>`
      + `<g class="pm__ring"><circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="37"/></g>`
      + `<text class="pm__arc"><textPath href="#${id}a" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>`
      + `<text class="pm__arc pm__arc--cn"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath></text>`
      + `<text class="pm__l1" x="60" y="59" text-anchor="middle">${esc(line1)}</text>`
      + `<text class="pm__l2" x="60" y="74" text-anchor="middle">${esc(line2)}</text>`
      + `<g class="pm__waves">${waves}</g>`
      + `</svg>`;
  }

  /* ---------------- 统一 API 客户端（httpOnly Cookie + 401 单飞刷新） ---------------- */
  class ApiError extends Error {
    constructor(message, status, errorCode, details) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.errorCode = errorCode || null;
      this.details = details || null;
    }
  }

  let refreshInFlight = null;
  async function tryRefresh() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) return false;
        const env = await res.json();
        return !!(env && env.success);
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  async function request(path, opts = {}) {
    const headers = { Accept: "application/json", ...(opts.headers || {}) };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`/api/v1${path}`, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

    if (res.status === 204) return undefined;

    let env = null;
    try {
      env = await res.json();
    } catch {
      throw new ApiError("服务器返回格式异常", res.status, "INTERNAL_ERROR");
    }

    if (!res.ok || !env.success) {
      const noRefresh = opts._retry || path.startsWith("/auth/") || path === "/me/password";
      if (res.status === 401 && env.errorCode === "UNAUTHORIZED" && !noRefresh) {
        const ok = await tryRefresh();
        if (ok) return request(path, { ...opts, _retry: true });
        if (window.Alpine && Alpine.store("auth")) {
          Alpine.store("auth").clearLocal();
        }
      }
      throw new ApiError(env.message || "请求失败", res.status, env.errorCode, env.details);
    }
    return env.data;
  }

  const api = {
    health: () => request("/health"),
    avatars: () => request("/avatars"),
    register: (body) => request("/auth/register", { method: "POST", body }),
    login: (body) => request("/auth/login", { method: "POST", body }),
    logout: () => request("/auth/logout", { method: "POST", body: {} }),
    me: () => request("/me"),
    updateProfile: (body) => request("/me", { method: "PATCH", body }),
    changePassword: (body) => request("/me/password", { method: "POST", body }),
    myStats: () => request("/me/stats"),
    myCapsules: (page = 1, pageSize = 20) => request(`/me/capsules?page=${page}&pageSize=${pageSize}`),
    deleteMyCapsule: (id) => request(`/me/capsules/${encodeURIComponent(id)}`, { method: "DELETE" }),
    myFavorites: (page = 1, pageSize = 20) => request(`/me/favorites?page=${page}&pageSize=${pageSize}`),
    favorite: (capsuleId) => request("/me/favorites", { method: "POST", body: { capsuleId } }),
    unfavorite: (capsuleId) => request(`/me/favorites/${encodeURIComponent(capsuleId)}`, { method: "DELETE" }),
    createCapsule: (body) => request("/capsules", { method: "POST", body }),
    capsuleByCode: (code, signal) => request(`/capsules/${encodeURIComponent(code)}`, { signal }),
    plaza: (params = {}) => {
      const sp = new URLSearchParams();
      if (params.sort) sp.set("sort", params.sort);
      if (params.filter) sp.set("filter", params.filter);
      if (params.q) sp.set("q", params.q);
      if (params.page) sp.set("page", String(params.page));
      if (params.pageSize) sp.set("pageSize", String(params.pageSize));
      const qs = sp.toString();
      return request(`/plaza/capsules${qs ? "?" + qs : ""}`);
    },
    plazaStats: (q) => request(`/plaza/stats${q ? "?q=" + encodeURIComponent(q) : ""}`),
    capsuleRecommendations: (count = 4) => request(`/capsule-recommendations?count=${count}`),
    suggestCapsule: (body) => request("/capsule-suggestion", { method: "POST", body }),
  };

  /* ---------------- 琥珀星空画布 ---------------- */
  const STAR = ["255,255,255", "255,255,255", "200,214,255", "255,226,180"];
  const MOTE = ["236,150,40", "245,176,66", "214,120,60", "160,130,240"];
  function startSky(canvas, dark) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};
    let w = 0, h = 0, frame = 0, parts = [], meteor = null;
    let nextMeteor = performance.now() + 3000 + Math.random() * 4000;

    const populate = () => {
      const n = Math.max(70, Math.min(dark ? 230 : 90, Math.round((w * h) / (dark ? 7000 : 20000))));
      const r = Math.random;
      parts = Array.from({ length: n }, () =>
        dark
          ? { x: r() * w, y: r() * h, r: r() < 0.08 ? 1.3 + r() * 0.8 : 0.35 + r() * 0.85, a: 0.3 + r() * 0.6, sp: 0.4 + r() * 1.6, ph: r() * 6.28, vx: 0.012 + r() * 0.03, vy: 0, c: STAR[(r() * STAR.length) | 0] }
          : { x: r() * w, y: r() * h, r: 1 + r() * 3.2, a: 0.1 + r() * 0.26, sp: 0.2 + r() * 0.7, ph: r() * 6.28, vx: (r() - 0.5) * 0.12, vy: -(0.05 + r() * 0.2), c: MOTE[(r() * MOTE.length) | 0] },
      );
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      populate();
    };
    const drawMeteor = (now) => {
      if (!meteor && now >= nextMeteor) {
        meteor = { x: w * (0.35 + Math.random() * 0.6), y: -20, vx: -(5 + Math.random() * 3), vy: 3 + Math.random() * 2, life: 0, max: 70 + Math.random() * 30 };
      }
      if (!meteor) return;
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      meteor.life += 1;
      const fade = Math.sin((meteor.life / meteor.max) * Math.PI);
      const tx = meteor.x - meteor.vx * 16, ty = meteor.y - meteor.vy * 16;
      const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty);
      g.addColorStop(0, `rgba(255,244,220,${0.9 * fade})`);
      g.addColorStop(1, "rgba(255,244,220,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(meteor.x, meteor.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (meteor.life >= meteor.max) {
        meteor = null;
        nextMeteor = now + 6000 + Math.random() * 9000;
      }
    };
    const draw = (now) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        let a = p.a;
        if (dark) {
          a *= 0.55 + 0.45 * Math.sin(t * p.sp + p.ph);
          p.x += p.vx;
          if (p.x > w + 4) p.x = -4;
        } else {
          p.x += p.vx + Math.sin(t * p.sp + p.ph) * 0.12;
          p.y += p.vy;
          if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
          if (p.x < -8) p.x = w + 8;
          if (p.x > w + 8) p.x = -8;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.c},${Math.max(0, a).toFixed(3)})`;
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      if (dark) drawMeteor(now);
      frame = requestAnimationFrame(draw);
    };
    const play = () => {
      cancelAnimationFrame(frame);
      if (fmt.reducedMotion()) {
        draw(performance.now());
        cancelAnimationFrame(frame);
      } else if (!document.hidden) {
        frame = requestAnimationFrame(draw);
      }
    };
    resize();
    play();
    const onResize = () => resize();
    const onVis = () => (document.hidden ? cancelAnimationFrame(frame) : play());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      ctx.clearRect(0, 0, w, h);
    };
  }

  /* ---------------- 皮肤 / 明暗转场工具 ---------------- */
  const THEME_COLOR = {
    paper: { light: "#F3EFE5", dark: "#131210" },
    amber: { light: "#faf5ea", dark: "#080b1a" },
  };
  const SKIN_LABEL = { paper: "时笺", amber: "琥珀" };

  function saveStorage(key, val) {
    try { localStorage.setItem(key, val); } catch {}
  }
  function syncThemeColor(skin, theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", (THEME_COLOR[skin] || THEME_COLOR.amber)[theme] || "#080b1a");
  }
  function runTransition(apply, cls, after) {
    const root = document.documentElement;
    if (!document.startViewTransition || fmt.reducedMotion()) {
      apply();
      return Promise.resolve();
    }
    root.classList.add(cls);
    let done = false;
    const run = () => {
      if (done) return;
      done = true;
      apply();
    };
    const vt = document.startViewTransition(run);
    setTimeout(run, 400);
    if (after) after(vt);
    return vt.finished.catch(() => {}).finally(() => root.classList.remove(cls));
  }

  /* ---------------- 清理创建页草稿（按账号隔离，登出/换账号必清） ---------------- */
  function clearAllDrafts() {
    try {
      const toRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("hellotime.draft.")) toRemove.push(k);
      }
      toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {}
  }

  /* ---------------- 工具：测量滑块位置（Seg / Tabs / Nav） ---------------- */
  function placeThumb(container, activeSelector, thumbSelector, animate) {
    if (!container) return;
    const active = container.querySelector(activeSelector);
    const thumb = container.querySelector(thumbSelector);
    if (!thumb) return;
    if (!active) {
      thumb.style.opacity = "0";
      return;
    }
    thumb.style.opacity = "1";
    thumb.style.transition = animate ? "" : "none";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate) {
      void thumb.offsetWidth;
      thumb.style.transition = "";
    }
  }

  /* ---------------- 暴露全局 HT 命名空间 ---------------- */
  window.HT = {
    fmt,
    paletteOf,
    avatarOf,
    avatarHtml,
    avatarStampHtml,
    capsuleArtSvg,
    iconSvg,
    waxHtml,
    postmarkSvg,
    ApiError,
    api,
    startSky,
    clearAllDrafts,
    placeThumb,
    SKIN_LABEL,
  };

  /* ---------------- 注册 Alpine Stores 与通用壳部件 ---------------- */
  document.addEventListener("alpine:initialized", () => {
    document.querySelectorAll("[data-server-rendered]").forEach((element) => element.remove());
  }, { once: true });

  document.addEventListener("alpine:init", () => {
    const root = document.documentElement;
    const initSkin = root.dataset.skin === "paper" ? "paper" : "amber";
    const initTheme = root.dataset.theme === "light" ? "light" : "dark";

    /* 1. UI 皮肤与明暗 */
    Alpine.store("ui", {
      skin: initSkin,
      theme: initTheme,
      scrolled: window.scrollY > 6,
      setSkin(next) {
        if (next !== "paper" && next !== "amber") return Promise.resolve();
        if (next === this.skin) return Promise.resolve();
        // 切到时笺写 prev，切到琥珀写 next，供 spec/styles/shell.css 柔光拂过转场使用
        root.dataset.skinDir = next === "paper" ? "prev" : "next";
        return runTransition(() => {
          root.dataset.skin = next;
          saveStorage("hellotime.skin", next);
          syncThemeColor(next, this.theme);
          this.skin = next;
        }, "is-skinning")
          .finally(() => {
            delete root.dataset.skinDir;
          })
          .then(() => {
            Alpine.store("feedback").toast(`已切换到「${SKIN_LABEL[next]}」`);
          });
      },
      toggleTheme(event) {
        const next = this.theme === "dark" ? "light" : "dark";
        let x = window.innerWidth - 80;
        let y = 32;
        if (event && event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          const kb = event.clientX === 0 && event.clientY === 0;
          x = kb ? r.left + r.width / 2 : event.clientX;
          y = kb ? r.top + r.height / 2 : event.clientY;
        }
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
        runTransition(
          () => {
            root.dataset.theme = next;
            saveStorage("hellotime.theme", next);
            syncThemeColor(this.skin, next);
            this.theme = next;
          },
          "is-theming",
          (vt) => {
            vt.ready
              .then(() =>
                root.animate(
                  { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                  { duration: 600, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" },
                ),
              )
              .catch(() => {});
          },
        );
      },
    });

    window.addEventListener(
      "scroll",
      () => {
        Alpine.store("ui").scrolled = window.scrollY > 6;
      },
      { passive: true },
    );

    /* 2. 认证会话（首帧由服务端直接注入，refreshMe 单飞 + 会话代际） */
    let authGen = 0;
    let meInFlight = null;
    Alpine.store("auth", {
      user: window.__HT_USER__ || null,
      setUser(u) {
        const prev = this.user;
        if (prev && (!u || prev.id !== u.id)) clearAllDrafts();
        authGen++;
        this.user = u;
      },
      clearLocal() {
        authGen++;
        clearAllDrafts();
        this.user = null;
      },
      refreshMe() {
        if (meInFlight) return meInFlight;
        const myGen = authGen;
        meInFlight = api
          .me()
          .then((u) => {
            if (myGen === authGen) this.user = u;
            return u;
          })
          .catch(() => null)
          .finally(() => {
            meInFlight = null;
          });
        return meInFlight;
      },
      async logout(callApi = true, opts = {}) {
        if (callApi) {
          try {
            await api.logout();
          } catch {
            Alpine.store("feedback").toast("登出未完成，请稍后重试", { tone: "error" });
            return false;
          }
        }
        authGen++;
        clearAllDrafts();
        if (!opts.keepUserUntilNav) {
          this.user = null;
        }
        return true;
      },
    });

    /* 3. 全局整秒节拍 */
    Alpine.store("clock", { now: Date.now() });
    setInterval(() => {
      Alpine.store("clock").now = Date.now();
    }, 1000);

    /* 4. Toast 与确认框 */
    let toastSeq = 0;
    let prevFocusEl = null;
    Alpine.store("feedback", {
      toasts: [],
      dialog: null,
      dialogShown: false,
      toast(msg, opt = {}) {
        const id = ++toastSeq;
        const tone = opt.tone || "success";
        this.toasts.push({ id, msg, tone, shown: false });
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const it = this.toasts.find((t) => t.id === id);
            if (it) it.shown = true;
          }),
        );
        setTimeout(() => {
          const it = this.toasts.find((t) => t.id === id);
          if (it) it.shown = false;
          setTimeout(() => {
            this.toasts = this.toasts.filter((t) => t.id !== id);
          }, 400);
        }, opt.ms || 2600);
      },
      confirm(opt) {
        return new Promise((resolve) => {
          if (this.dialog && this.dialog.resolve) this.dialog.resolve(false);
          prevFocusEl = document.activeElement;
          this.dialogShown = false;
          this.dialog = {
            title: opt.title || "",
            bodyHtml: opt.bodyHtml || "",
            confirm: opt.confirm || "确定",
            cancel: opt.cancel || "取消",
            tone: opt.tone || "primary",
            markHtml: opt.markHtml || "",
            resolve,
          };
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              this.dialogShown = true;
              const okBtn = document.querySelector('[data-testid="confirm-ok"]');
              if (okBtn) okBtn.focus();
            }),
          );
        });
      },
      resolveDialog(ok) {
        const d = this.dialog;
        if (!d) return;
        this.dialogShown = false;
        this.dialog = null;
        if (prevFocusEl && typeof prevFocusEl.focus === "function") {
          try { prevFocusEl.focus(); } catch {}
        }
        prevFocusEl = null;
        d.resolve(!!ok);
      },
      async copyText(text, okMsg) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;opacity:0;left:-99px";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); } catch {}
          ta.remove();
        }
        if (okMsg) this.toast(okMsg);
      },
      askLogin(kind) {
        const skin = Alpine.store("ui").skin;
        const mark = (ch, ic) =>
          `<div class="dlg__mark">${skin === "paper" ? `<span class="seal seal--line" aria-hidden="true">${ch}</span>` : iconSvg(ic)}</div>`;
        if (kind === "favorite") {
          return this.confirm({
            title: "登录后才能收藏",
            bodyHtml: "<p>收藏的胶囊会出现在「我收藏的」里——等它启封的那天，你不会错过。</p>",
            confirm: "去登录",
            cancel: "再逛逛",
            markHtml: mark("藏", "heart"),
          });
        }
        return this.confirm({
          title: "登录后才能写胶囊",
          bodyHtml: "<p>胶囊会存在你的账号下：之后在「我的」里随时能找到它、复制胶囊码，或者删除它。</p>",
          confirm: "去登录",
          cancel: "再逛逛",
          markHtml: mark("缄", "pen"),
        });
      },
      async goCreate(event) {
        if (Alpine.store("auth").user) return;
        if (event) event.preventDefault();
        if (await this.askLogin("create")) {
          window.location.assign(fmt.loginPath("/create"));
        }
      },
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && Alpine.store("feedback").dialog) {
        Alpine.store("feedback").resolveDialog(false);
      }
    });

    /* 5. 外壳通用组件：星空背景、用户菜单、导航滑块 */
    Alpine.data("amberBackdrop", () => ({
      stop: null,
      init() {
        const sync = () => {
          if (this.stop) {
            this.stop();
            this.stop = null;
          }
          const ui = Alpine.store("ui");
          if (ui.skin === "amber" && this.$refs.canvas) {
            this.stop = startSky(this.$refs.canvas, ui.theme !== "light");
          }
        };
        this.$watch("$store.ui.skin", sync);
        this.$watch("$store.ui.theme", sync);
        sync();
      },
      destroy() {
        if (this.stop) this.stop();
      },
    }));

    Alpine.data("userMenu", () => ({
      open: false,
      toggle() {
        this.open = !this.open;
      },
      close() {
        this.open = false;
      },
      async doLogout() {
        this.open = false;
        const p = window.location.pathname;
        const isProtected = p === "/create" || p === "/me" || p.startsWith("/me/");
        const loggedOut = await Alpine.store("auth").logout(true, { keepUserUntilNav: isProtected });
        if (!loggedOut) return;
        if (isProtected) {
          window.location.assign("/");
          return;
        }
        Alpine.store("feedback").toast("已登出");
      },
    }));

    Alpine.data("amberNavInk", () => ({
      placed: false,
      init() {
        const update = (animate) => placeThumb(this.$el, ".nav__link.is-active", ".nav__ink", animate);
        this.$nextTick(() => {
          update(false);
          this.placed = true;
        });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => update(false));
        }
        window.addEventListener("resize", () => update(false));
      },
    }));
  });
})();
