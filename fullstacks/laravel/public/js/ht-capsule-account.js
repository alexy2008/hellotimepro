/* ============================================================
 * HelloTime Pro Laravel 全栈 · 胶囊详情 + 登录 / 注册 + 「我的」（2.0）
 * - capsuleDetailPage：倒计时归零后以服务端 isOpened 为准退避轮询，带 AbortController 取消
 * - loginPage / registerPage：表单状态跨皮肤保留，按 Unicode 码点校验昵称
 * - mePage：我的统计、我创建的 / 我收藏的分页加载更多（删除/取消收藏后边界页重读去重）、资料与密码
 * ============================================================ */
(function () {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NICK_RE = /^[\p{L}\p{N}_-]{2,20}$/u;
  const pwdRules = (v) => ({ len: v.length >= 8, alpha: /[A-Za-z]/.test(v), digit: /\d/.test(v) });
  const pwdValid = (v) => { const r = pwdRules(v); return r.len && r.alpha && r.digit; };

  function computeNickState(v, errors) {
    if (errors && errors.nickname) {
      return { state: errors.nicknameState === "taken" ? "taken" : "invalid", hint: errors.nickname };
    }
    const t = String(v || "").trim();
    if (!t) return { state: "", hint: "" };
    if (Array.from(t).length < 2) return { state: "", hint: "至少 2 个字符" };
    if (!NICK_RE.test(t)) return { state: "invalid", hint: "只能用字母、数字、下划线和连字符" };
    return { state: "valid", hint: "" };
  }

  function mapFieldErrors(e, nicknameChanged = false) {
    if (!(e instanceof HT.ApiError)) return { form: "网络异常，请稍后再试" };
    const out = {};
    for (const d of e.details || []) out[d.field] = d.message;
    if (out.nickname && e.status === 409) out.nicknameState = "taken";
    if (!Object.keys(out).length) out.form = e.message;
    if (nicknameChanged) {
      delete out.nickname;
      delete out.nicknameState;
    }
    return out;
  }

  const RING_C = 2 * Math.PI * 150;
  const PAGE_SIZE = 20;

  document.addEventListener("alpine:init", () => {
    /* ================ 1. 胶囊详情页 ================ */
    Alpine.data("capsuleDetailPage", () => {
      const init = window.__HT_INIT__ || {};
      let loadGen = 0;
      let openingAbort = null;

      return {
        code: init.code || "",
        c: init.capsule || null,
        status: init.status || (init.capsule ? "ok" : "missing"),
        // 时笺启封状态
        paperOpening: null, // null | { crack: 'whole'|'split'|'cracked', open: boolean, rising: boolean }
        paperHost: "",
        // 琥珀启封状态
        amberPhase: "", // '' | 'shaking' | 'open'
        reveal: false,

        get isOpenedView() {
          if (!this.c || !this.c.isOpened) return false;
          const skin = Alpine.store("ui").skin;
          return skin === "paper" ? !this.paperOpening : !this.amberPhase;
        },
        get openAtMs() {
          return this.c ? HT.fmt.ms(this.c.openAt) : 0;
        },
        get createdAtMs() {
          return this.c ? HT.fmt.ms(this.c.createdAt) : 0;
        },
        get cd() {
          return HT.fmt.cd(this.openAtMs, Alpine.store("clock").now);
        },
        get waitPct() {
          if (!this.c) return 0;
          const span = this.openAtMs - this.createdAtMs;
          if (span <= 0) return 100;
          return HT.fmt.clamp(((Alpine.store("clock").now - this.createdAtMs) / span) * 100, 0, 100);
        },
        get ringDash() {
          return `${((RING_C * this.waitPct) / 100).toFixed(1)} ${RING_C.toFixed(1)}`;
        },

        init() {
          this.$watch("$store.auth.user", (u) => {
            if (!u && this.c) this.c.favoritedByMe = false;
          });
          // 监听整秒节拍：倒计时归零那一秒触发启封
          this.$watch("$store.clock.now", (now) => {
            if (this.c && !this.c.isOpened && HT.fmt.ms(this.c.openAt) <= now && !openingAbort) {
              this.runOpening();
            }
          });
          // 换肤时取消当前皮肤进行中的动画/轮询，若尚未开启则由新皮肤重新接手
          this.$watch("$store.ui.skin", () => {
            if (openingAbort) {
              openingAbort.abort();
              openingAbort = null;
              this.paperOpening = null;
              this.paperHost = "";
              this.amberPhase = "";
              if (this.c && !this.c.isOpened && HT.fmt.ms(this.c.openAt) <= Alpine.store("clock").now) {
                this.$nextTick(() => this.runOpening());
              }
            }
          });
          // 若进入页面时已到点但服务端尚未切为 isOpened
          if (this.c && !this.c.isOpened && HT.fmt.ms(this.c.openAt) <= Date.now()) {
            this.runOpening();
          }
        },
        destroy() {
          loadGen += 1;
          if (openingAbort) {
            openingAbort.abort();
            openingAbort = null;
          }
        },
        async reload() {
          const my = ++loadGen;
          this.status = "loading";
          try {
            const d = await HT.api.capsuleByCode(this.code);
            if (my !== loadGen) return;
            this.c = d;
            this.status = "ok";
            document.title = `${d.title} · HelloTime Pro`;
          } catch (e) {
            if (my !== loadGen) return;
            this.status = e instanceof HT.ApiError && e.status === 404 ? "missing" : "error";
          }
        },
        async awaitOpened(signal) {
          for (let i = 0; !signal.aborted; i++) {
            try {
              const d = await HT.api.capsuleByCode(this.code, signal);
              if (signal.aborted) return null;
              if (d.isOpened) {
                this.c = d;
                return d;
              }
            } catch (e) {
              if (signal.aborted) return null;
              if (e instanceof HT.ApiError && e.status === 404) {
                this.c = null;
                this.status = "missing";
                return null;
              }
            }
            await HT.fmt.sleep(Math.min(1000 * (i + 1), 5000));
          }
          return null;
        },
        async runOpening() {
          if (openingAbort) return;
          const ac = new AbortController();
          openingAbort = ac;
          const { signal } = ac;
          const skin = Alpine.store("ui").skin;
          const reduced = HT.fmt.reducedMotion();

          if (skin === "paper") {
            this.paperOpening = { crack: "whole", open: false, rising: false };
            this.paperHost = "is-opening";
            if (!reduced) {
              this.paperOpening = { crack: "split", open: false, rising: false };
              await HT.fmt.sleep(60); if (signal.aborted) return;
              this.paperOpening = { crack: "cracked", open: false, rising: false };
              await HT.fmt.sleep(620); if (signal.aborted) return;
              this.paperOpening = { crack: "cracked", open: true, rising: false };
              await HT.fmt.sleep(760); if (signal.aborted) return;
              this.paperOpening = { crack: "cracked", open: true, rising: true };
              await HT.fmt.sleep(900); if (signal.aborted) return;
              this.paperHost = "is-opening is-leaving";
              await HT.fmt.sleep(380); if (signal.aborted) return;
            }
            if (!(await this.awaitOpened(signal)) || signal.aborted) return;
            this.paperHost = "";
            this.paperOpening = null;
            this.reveal = true;
            openingAbort = null;
            window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            Alpine.store("feedback").toast("胶囊已启封");
          } else {
            if (!reduced) {
              this.amberPhase = "shaking";
              window.scrollTo({ top: 0, behavior: "smooth" });
              await HT.fmt.sleep(820); if (signal.aborted) return;
              this.amberPhase = "open";
              await HT.fmt.sleep(1150); if (signal.aborted) return;
            }
            if (!(await this.awaitOpened(signal)) || signal.aborted) return;
            this.amberPhase = "";
            this.reveal = true;
            openingAbort = null;
            Alpine.store("feedback").toast("胶囊已开启");
          }
        },
        copyCode() {
          if (this.c) Alpine.store("feedback").copyText(this.c.code, `已复制胶囊码 ${this.c.code}`);
        },
        copyLink() {
          if (this.c) Alpine.store("feedback").copyText(`${window.location.origin}/capsules/${this.c.code}`, "已复制分享链接");
        },
        cdDaysStr() {
          const d = this.cd.d;
          return d > 99 ? String(d) : HT.fmt.pad2(d);
        },
      };
    });

    /* ================ 2. 登录页（表单值跨皮肤保留） ================ */
    Alpine.data("loginPage", () => {
      const init = window.__HT_INIT__ || {};
      return {
        email: "",
        password: "",
        showPwd: false,
        errors: {},
        busy: false,
        redirect: init.redirect || null,
        registerHref() {
          return this.redirect ? `/register?redirect=${encodeURIComponent(this.redirect)}` : "/register";
        },
        clearFormErr() {
          if (this.errors.form) this.errors = {};
        },
        async submit() {
          const errs = {};
          if (!EMAIL_RE.test(this.email.trim())) errs.email = "请输入有效的邮箱地址";
          else if (!this.password) errs.password = "请输入密码";
          this.errors = errs;
          if (Object.keys(errs).length) return;
          this.busy = true;
          try {
            const t = await HT.api.login({ email: this.email.trim(), password: this.password });
            Alpine.store("auth").setUser(t.user);
            Alpine.store("feedback").toast(`欢迎回来，${t.user.nickname}`);
            const dest = this.redirect ? HT.fmt.safeRedirect(this.redirect, "/") : "/me/created";
            window.location.assign(dest);
          } catch (e) {
            this.errors = {
              form: e instanceof HT.ApiError && e.status === 401
                ? "邮箱或密码不正确"
                : e instanceof HT.ApiError ? e.message : "网络异常，请稍后再试",
            };
          } finally {
            this.busy = false;
          }
        },
      };
    });

    /* ================ 3. 注册页（表单值跨皮肤保留 + Unicode 昵称校验 + 头像加载） ================ */
    Alpine.data("registerPage", () => {
      const init = window.__HT_INIT__ || {};
      return {
        email: "",
        nickname: "",
        password: "",
        avatarId: "neo",
        showPwd: false,
        avatarIds: init.avatarIds && init.avatarIds.length ? init.avatarIds : (window.__HT_AVATARS__ || []).map((a) => a.id),
        errors: {},
        busy: false,
        redirect: init.redirect || null,

        init() {
          // 同步从后端 /api/v1/avatars 确认头像目录
          HT.api.avatars().then((list) => {
            if (Array.isArray(list) && list.length) this.avatarIds = list.map((a) => a.id);
          }).catch(() => {});
        },
        loginHref() {
          return this.redirect ? `/login?redirect=${encodeURIComponent(this.redirect)}` : "/login";
        },
        get ns() {
          return computeNickState(this.nickname, this.errors);
        },
        get pwdR() {
          return pwdRules(this.password);
        },
        setNickname(v) {
          this.nickname = v;
          if (this.errors.nickname || this.errors.nicknameState) {
            const next = { ...this.errors };
            delete next.nickname;
            delete next.nicknameState;
            this.errors = next;
          }
        },
        moveAvatar(dir, boxEl) {
          const ids = this.avatarIds;
          if (!ids.length) return;
          const i = Math.max(0, ids.indexOf(this.avatarId));
          const next = ids[(i + dir + ids.length) % ids.length];
          this.avatarId = next;
          requestAnimationFrame(() => {
            const btn = boxEl && boxEl.querySelector(`[data-value="${next}"]`);
            if (btn) btn.focus();
          });
        },
        async submit() {
          const errs = {};
          const nickTrim = this.nickname.trim();
          if (!EMAIL_RE.test(this.email.trim())) errs.email = "请输入有效的邮箱地址";
          else if (!NICK_RE.test(nickTrim)) errs.nickname = "昵称需为 2–20 个字符：字母、数字、下划线或连字符";
          else if (!pwdValid(this.password)) errs.password = "密码至少 8 位，且同时包含字母和数字";
          this.errors = errs;
          if (Object.keys(errs).length) return;
          this.busy = true;
          const submittedNick = this.nickname;
          try {
            const t = await HT.api.register({
              email: this.email.trim(),
              nickname: nickTrim,
              password: this.password,
              avatarId: this.avatarId,
            });
            Alpine.store("auth").setUser(t.user);
            Alpine.store("feedback").toast(`你好，${t.user.nickname}`);
            const dest = this.redirect ? HT.fmt.safeRedirect(this.redirect, "/") : "/create";
            window.location.assign(dest);
          } catch (e) {
            this.errors = mapFieldErrors(e, submittedNick !== this.nickname);
          } finally {
            this.busy = false;
          }
        },
      };
    });

    /* ================ 4. 「我的」三页签（统计 + 分页加载更多 + 删除 + 资料 + 改密） ================ */
    Alpine.data("mePage", () => {
      const init = window.__HT_INIT__ || {};
      const user = Alpine.store("auth").user || { id: "", email: "", nickname: "", avatarId: "neo", createdAt: new Date().toISOString() };
      let listSeq = 0;

      return {
        tab: init.tab || "created",
        stats: init.stats || null,
        items: init.items || [],
        total: init.total || 0,
        moreBusy: false,
        listError: false,

        // 资料与改密表单（放在外层，切换皮肤保留）
        nickname: user.nickname || "",
        avatarId: user.avatarId || "neo",
        avatarIds: init.avatarIds && init.avatarIds.length ? init.avatarIds : (window.__HT_AVATARS__ || []).map((a) => a.id),
        profErrors: {},
        profBusy: false,
        profMsg: null,

        pwdCurrent: "",
        pwdNew: "",
        pwdConfirm: "",
        showCur: false,
        showNew: false,
        showConfirm: false,
        pwdErrors: {},
        pwdBusy: false,
        pwdMsg: null,

        get hasMore() {
          return this.items.length < this.total;
        },
        get profNs() {
          const u = Alpine.store("auth").user;
          if (u && this.nickname.trim() === u.nickname && !this.profErrors.nickname) {
            return { state: "", hint: "" };
          }
          return computeNickState(this.nickname, this.profErrors);
        },
        get pwdR() {
          return pwdRules(this.pwdNew);
        },

        init() {
          if (this.tab === "profile") {
            HT.api.avatars().then((list) => {
              if (Array.isArray(list) && list.length) this.avatarIds = list.map((a) => a.id);
            }).catch(() => {});
          }
        },
        async refreshStats() {
          try {
            this.stats = await HT.api.myStats();
          } catch {}
        },
        fetchPage(pageNum) {
          return this.tab === "created"
            ? HT.api.myCapsules(pageNum, PAGE_SIZE)
            : HT.api.myFavorites(pageNum, PAGE_SIZE);
        },
        async reloadList() {
          const my = ++listSeq;
          try {
            const r = await this.fetchPage(1);
            if (my !== listSeq) return;
            this.items = r.items;
            this.total = r.pagination.total;
            this.listError = false;
          } catch {
            if (my === listSeq) this.listError = true;
          }
        },
        /** 按仍显示条数算下一页，重读前移边界页并按 ID 去重（升级清单 §2.6） */
        async loadMore() {
          if (this.moreBusy) return;
          const my = listSeq;
          this.moreBusy = true;
          try {
            const nextPage = Math.floor(this.items.length / PAGE_SIZE) + 1;
            const r = await this.fetchPage(nextPage);
            if (my !== listSeq) return;
            const have = new Set(this.items.map((i) => i.id));
            this.items = [...this.items, ...r.items.filter((i) => !have.has(i.id))];
            this.total = r.pagination.total;
          } catch {
            if (my === listSeq) Alpine.store("feedback").toast("加载失败，请稍后再试", { tone: "error" });
          } finally {
            if (my === listSeq) this.moreBusy = false;
          }
        },
        dropItem(id) {
          listSeq += 1;
          this.moreBusy = false;
          this.items = this.items.filter((i) => i.id !== id);
          this.total = Math.max(0, this.total - 1);
          if (this.items.length === 0 && this.total > 0) {
            this.reloadList();
          }
        },
        async removeCapsule(c) {
          const skin = Alpine.store("ui").skin;
          const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const markHtml = skin === "paper"
            ? '<div class="dlg__mark"><span class="seal seal--line" aria-hidden="true">删</span></div>'
            : `<div class="dlg__art">${HT.capsuleArtSvg(c.code, "opened", 120)}</div>`;
          const ok = await Alpine.store("feedback").confirm({
            title: "删除这枚胶囊？",
            bodyHtml: `<p>《${esc(c.title)}》会被永久删除。持有胶囊码 <b class="mono">${esc(c.code)}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。</p><p class="dlg__warn">此操作不可恢复。</p>`,
            confirm: "删除",
            cancel: "再想想",
            tone: "danger",
            markHtml,
          });
          if (!ok) return;
          try {
            await HT.api.deleteMyCapsule(c.id);
            this.dropItem(c.id);
            Alpine.store("feedback").toast(`已删除《${c.title}》`);
            await this.refreshStats();
          } catch (e) {
            Alpine.store("feedback").toast(e instanceof HT.ApiError ? e.message : "删除失败，请稍后再试", { tone: "error" });
          }
        },
        onFavChange(id, favorited) {
          if (this.tab === "favorites" && !favorited) {
            this.dropItem(id);
          }
          this.refreshStats();
        },
        isOpened(c) {
          return !!(c.isOpened || HT.fmt.ms(c.openAt) <= Alpine.store("clock").now);
        },
        isMine(nickname) {
          const u = Alpine.store("auth").user;
          return !!(u && u.nickname === nickname);
        },
        async doLogout() {
          await Alpine.store("auth").logout(true, { keepUserUntilNav: true });
          window.location.assign("/");
        },

        // ---- 资料页 ----
        setProfNickname(v) {
          this.nickname = v;
          if (this.profErrors.nickname || this.profErrors.nicknameState) {
            const next = { ...this.profErrors };
            delete next.nickname;
            delete next.nicknameState;
            this.profErrors = next;
          }
        },
        moveAvatar(dir, boxEl) {
          const ids = this.avatarIds;
          if (!ids.length) return;
          const i = Math.max(0, ids.indexOf(this.avatarId));
          const next = ids[(i + dir + ids.length) % ids.length];
          this.avatarId = next;
          requestAnimationFrame(() => {
            const btn = boxEl && boxEl.querySelector(`[data-value="${next}"]`);
            if (btn) btn.focus();
          });
        },
        resetProfile() {
          const u = Alpine.store("auth").user;
          if (!u) return;
          this.nickname = u.nickname;
          this.avatarId = u.avatarId;
          this.profErrors = {};
          this.profMsg = null;
        },
        async saveProfile() {
          const u = Alpine.store("auth").user;
          if (!u) return;
          this.profMsg = null;
          this.profErrors = {};
          const patch = {};
          if (this.nickname.trim() !== u.nickname) patch.nickname = this.nickname.trim();
          if (this.avatarId !== u.avatarId) patch.avatarId = this.avatarId;
          if (!Object.keys(patch).length) {
            Alpine.store("feedback").toast("没有需要保存的修改", { tone: "info" });
            this.profMsg = { type: "info", text: "没有改动" };
            return;
          }
          if (patch.nickname !== undefined && !NICK_RE.test(patch.nickname)) {
            this.profErrors = { nickname: "昵称需为 2–20 个字符：字母、数字、下划线或连字符" };
            return;
          }
          this.profBusy = true;
          const submittedNick = this.nickname;
          try {
            const updated = await HT.api.updateProfile(patch);
            Alpine.store("auth").setUser(updated);
            this.nickname = updated.nickname;
            this.avatarId = updated.avatarId;
            this.profMsg = { type: "ok", text: "已保存" };
            Alpine.store("feedback").toast("资料已更新");
            await this.refreshStats();
          } catch (e) {
            const errs = mapFieldErrors(e, submittedNick !== this.nickname);
            this.profErrors = errs;
            if (errs.form) this.profMsg = { type: "err", text: errs.form };
          } finally {
            this.profBusy = false;
          }
        },
        async changePassword() {
          this.pwdMsg = null;
          const errs = {};
          if (!this.pwdCurrent) errs.current = "请输入当前密码";
          else if (!pwdValid(this.pwdNew)) errs.next = "新密码至少 8 位，且同时包含字母和数字";
          else if (this.pwdNew !== this.pwdConfirm) errs.confirm = "两次输入的新密码不一致";
          this.pwdErrors = errs;
          if (Object.keys(errs).length) return;
          this.pwdBusy = true;
          try {
            await HT.api.changePassword({ currentPassword: this.pwdCurrent, newPassword: this.pwdNew });
            this.pwdCurrent = "";
            this.pwdNew = "";
            this.pwdConfirm = "";
            this.pwdMsg = { type: "ok", text: "密码已更新。3 秒后将自动登出，请用新密码重新登录。" };
            setTimeout(async () => {
              await Alpine.store("auth").logout(false, { keepUserUntilNav: true });
              window.location.assign("/login");
            }, 3000);
          } catch (e) {
            this.pwdBusy = false;
            this.pwdErrors = { current: e instanceof HT.ApiError ? e.message : "修改失败，请稍后再试" };
          }
        },
      };
    });

    /* ================ 5. 「我的」页签滑块（时笺墨线 / 琥珀胶囊底） ================ */
    Alpine.data("meTabsIndicator", (activeSel, thumbSel) => ({
      placed: false,
      sync(animate) {
        this.$nextTick(() => {
          HT.placeThumb(this.$el, activeSel, thumbSel, animate);
          this.placed = true;
        });
      },
      init() {
        this.sync(false);
        this.$watch("stats", () => this.sync(false));
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => this.sync(false));
        }
        window.addEventListener("resize", () => this.sync(false));
      },
    }));
  });
})();
