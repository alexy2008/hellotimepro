/* ============================================================
 * HelloTime Pro Laravel 全栈 · 首页广场 + 开启页 + 8 格输码（2.0）
 * - 共享逻辑放在外层 Alpine 组件，切换皮肤不丢搜索词、防抖计时器、筛选与半截胶囊码
 * - 琥珀输码框处理 InputEvent.data 一次带进完整 8 位码时从头填入
 * ============================================================ */
(function () {
  "use strict";

  const MSG_FORMAT = "胶囊码是 8 位大写字母与数字";
  const MSG_NOT_FOUND = "没有找到这枚胶囊，请核对胶囊码——留意 O 与 0、I 与 1";
  const cleanCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  /** 凭码开启共享状态机：首页就地输码与开启页共用 */
  function makeCodeOpener() {
    let generation = 0;
    let pending = null;
    return {
      value: "",
      state: "", // '' | 'checking' | 'ok' | 'error'
      error: "",
      shake: 0,
      fail(msg) {
        this.state = "error";
        this.error = msg;
        this.shake += 1;
      },
      setValue(v) {
        generation += 1;
        pending = null;
        this.value = cleanCode(v).slice(0, 8);
        this.state = "";
        this.error = "";
      },
      async go(code) {
        const norm = cleanCode(code !== undefined ? code : this.value).slice(0, 8);
        if (pending === norm) return;
        const reqId = ++generation;
        if (norm.length !== 8) {
          this.fail(MSG_FORMAT);
          return;
        }
        pending = norm;
        this.error = "";
        this.state = "checking";
        try {
          const [c] = await Promise.all([
            HT.api.capsuleByCode(norm),
            HT.fmt.sleep(HT.fmt.reducedMotion() ? 60 : 480),
          ]);
          if (reqId !== generation) return;
          this.state = "ok";
          await HT.fmt.sleep(HT.fmt.reducedMotion() ? 40 : 260);
          if (reqId === generation) {
            window.location.assign(`/capsules/${c.code}`);
          }
        } catch (e) {
          if (reqId === generation) {
            this.fail(e instanceof HT.ApiError && e.status === 404 ? MSG_NOT_FOUND : "查询失败，请稍后再试");
          }
        } finally {
          if (reqId === generation) pending = null;
        }
      },
      cancel() {
        generation += 1;
        pending = null;
      },
    };
  }

  function pageNumbers(page, total) {
    const out = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - page) <= 1) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }

  document.addEventListener("alpine:init", () => {
    /* ---------------- 时笺 8 格输码（8 个真实输入框） ---------------- */
    Alpine.data("paperCodeInput", (autoFocus = false) => ({
      shaking: false,
      lastShake: 0,
      init() {
        // 跳过初值，切皮肤后新视图挂载不会误抖动
        this.lastShake = this.opener.shake;
        this.$watch("opener.shake", (n) => {
          if (n === this.lastShake || !n) return;
          this.lastShake = n;
          this.shaking = true;
          setTimeout(() => { this.shaking = false; }, 480);
          const inputs = this.$el.querySelectorAll("input.code__cell");
          if (inputs[7]) inputs[7].focus();
        });
        if (autoFocus) {
          setTimeout(() => {
            const first = this.$el.querySelector("input.code__cell");
            HT.fmt.focusIfIdle(first);
          }, 350);
        }
      },
      cellAt(i) {
        return this.opener.value[i] || "";
      },
      focusCell(idx) {
        const inputs = this.$el.querySelectorAll("input.code__cell");
        const target = inputs[Math.max(0, Math.min(7, idx))];
        if (target) target.focus();
      },
      commitCells(arr, focusAt, completeNow) {
        const v = arr.join("").slice(0, 8);
        this.opener.setValue(v);
        this.$nextTick(() => {
          const inputs = this.$el.querySelectorAll("input.code__cell");
          inputs.forEach((el, k) => { el.value = this.opener.value[k] || ""; });
          this.focusCell(focusAt);
        });
        if (completeNow && v.length === 8) this.opener.go(v);
      },
      fillFrom(str, from) {
        const s = cleanCode(str).slice(0, 8 - from);
        const arr = Array.from({ length: 8 }, (_, k) => this.opener.value[k] || "");
        Array.from(s).forEach((ch, k) => { arr[from + k] = ch; });
        this.commitCells(arr, Math.min(7, from + s.length), true);
      },
      onInput(i, e) {
        const v = cleanCode(e.target.value);
        if (v.length > 1) {
          this.fillFrom(v, v.length >= 8 ? 0 : i);
          return;
        }
        const arr = Array.from({ length: 8 }, (_, k) => this.opener.value[k] || "");
        arr[i] = v;
        this.commitCells(arr, v && i < 7 ? i + 1 : i, !!v);
      },
      onKeyDown(i, e) {
        const cur = this.opener.value[i] || "";
        if (e.key === "Backspace" && !cur && i > 0) {
          e.preventDefault();
          const arr = Array.from({ length: 8 }, (_, k) => this.opener.value[k] || "");
          arr[i - 1] = "";
          this.commitCells(arr, i - 1, false);
        } else if (e.key === "ArrowLeft" && i > 0) {
          e.preventDefault();
          this.focusCell(i - 1);
        } else if (e.key === "ArrowRight" && i < 7) {
          e.preventDefault();
          this.focusCell(i + 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          this.opener.go(this.opener.value);
        }
      },
      onPaste(i, e) {
        e.preventDefault();
        const t = cleanCode((e.clipboardData && e.clipboardData.getData("text")) || "");
        if (t) this.fillFrom(t, t.length >= 8 ? 0 : i);
      },
    }));

    /* ---------------- 琥珀 8 格输码（透明原生框 + 8 个展示格） ---------------- */
    Alpine.data("amberCodeInput", (autoFocus = false) => ({
      focused: false,
      shaking: false,
      lastShake: 0,
      prevLen: 0,
      popFrom: 8,
      init() {
        this.lastShake = this.opener.shake;
        this.prevLen = this.opener.value.length;
        this.$watch("opener.shake", (n) => {
          if (n === this.lastShake || !n) return;
          this.lastShake = n;
          this.shaking = true;
          setTimeout(() => { this.shaking = false; }, 480);
        });
        this.$watch("opener.value", (v) => {
          if (v.length > this.prevLen) {
            this.popFrom = this.prevLen;
          } else {
            this.popFrom = 8;
          }
          this.prevLen = v.length;
        });
        if (autoFocus) {
          setTimeout(() => HT.fmt.focusIfIdle(this.$refs.nativeInput), 350);
        }
      },
      onInput(e) {
        if (e.isComposing) return;
        // 关键：一次输入事件带进完整 8 位码（粘贴、自动填充、Playwright fill）时从头覆盖，绝不接在半截码后
        const chunk = cleanCode(e.data || "");
        const v = chunk.length === 8 ? chunk : cleanCode(e.target.value).slice(0, 8);
        e.target.value = v;
        this.opener.setValue(v);
        if (v.length === 8) this.opener.go(v);
      },
      onCompositionEnd(e) {
        const v = cleanCode(e.target.value).slice(0, 8);
        e.target.value = v;
        this.opener.setValue(v);
        if (v.length === 8) this.opener.go(v);
      },
      onFocus(e) {
        this.focused = true;
        const n = e.target.value.length;
        try { e.target.setSelectionRange(n, n); } catch {}
      },
    }));

    /* ---------------- 分段滑块辅助 ---------------- */
    Alpine.data("segControl", (watchExpr) => ({
      placed: false,
      sync(animate) {
        this.$nextTick(() => {
          HT.placeThumb(this.$el, ".seg__opt.is-active", ".seg__thumb", animate);
          this.placed = true;
        });
      },
      init() {
        this.sync(false);
        if (watchExpr) {
          this.$watch(watchExpr, () => this.sync(this.placed));
        }
        this.$watch("counts", () => this.sync(false));
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => this.sync(false));
        }
        window.addEventListener("resize", () => this.sync(false));
      },
    }));

    /* ---------------- 收藏按钮交互（共享乐观更新逻辑） ---------------- */
    Alpine.data("favBtn", (getCapsule, onAfterChange) => ({
      busy: false,
      pop: 0,
      burst: false,
      get cap() {
        return getCapsule();
      },
      async toggle(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!Alpine.store("auth").user) {
          if (await Alpine.store("feedback").askLogin("favorite")) {
            window.location.assign(HT.fmt.loginPath(window.location.pathname + window.location.search));
          }
          return;
        }
        const cap = this.cap;
        if (!cap || this.busy) return;
        this.busy = true;
        const prevOn = !!cap.favoritedByMe;
        const prevCount = Number(cap.favoriteCount || 0);
        const next = !prevOn;
        const guess = Math.max(0, prevCount + (next ? 1 : -1));
        cap.favoritedByMe = next;
        cap.favoriteCount = guess;
        if (next) {
          this.pop += 1;
          this.burst = true;
          setTimeout(() => { this.burst = false; }, 720);
        }
        try {
          let finalCount = guess;
          if (next) {
            const res = await HT.api.favorite(cap.id);
            finalCount = res.favoriteCount;
          } else {
            await HT.api.unfavorite(cap.id);
            Alpine.store("feedback").toast("已取消收藏");
          }
          cap.favoriteCount = finalCount;
          if (typeof onAfterChange === "function") onAfterChange(cap.id, next, finalCount);
        } catch {
          cap.favoritedByMe = prevOn;
          cap.favoriteCount = prevCount;
          Alpine.store("feedback").toast("收藏没有成功，请稍后再试", { tone: "error" });
        } finally {
          this.busy = false;
        }
      },
    }));

    /* ---------------- 首页广场页面 ---------------- */
    Alpine.data("plazaHome", () => {
      const init = window.__HT_INIT__ || {};
      let listSeq = 0;
      let countSeq = 0;
      let searchTimer = null;
      let dueRefreshing = false;

      return {
        sort: init.query?.sort ?? "new",
        filter: init.query?.filter ?? "all",
        q: init.query?.q ?? "",
        qInput: init.query?.q ?? "",
        page: init.query?.page ?? 1,
        pageSize: 9,

        items: init.items || [],
        pagination: init.pagination || null,
        counts: init.counts || null,
        overview: init.overview || null,
        featured: init.featured || null,
        loading: false,
        error: null,

        opener: makeCodeOpener(),

        init() {
          this.writeQueryToUrl();
          this.$watch("$store.auth.user", (u) => {
            if (!u) {
              this.items.forEach((it) => { it.favoritedByMe = false; });
              if (this.featured) this.featured.favoritedByMe = false;
            }
          });
          // 按「/」聚焦当前皮肤搜索框
          this._onKey = (e) => {
            const tag = (document.activeElement && document.activeElement.tagName || "").toUpperCase();
            if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
              e.preventDefault();
              const input = document.querySelector('[data-testid="plaza-search"]');
              if (input) input.focus();
            }
          };
          document.addEventListener("keydown", this._onKey);

          // 监听整秒时钟：列表或精选里有胶囊刚好到点，整页刷新一次
          this.$watch("$store.clock.now", (now) => {
            if (dueRefreshing) return;
            const list = this.featured ? [...this.items, this.featured] : this.items;
            const due = list.some((c) => !c.isOpened && HT.fmt.ms(c.openAt) <= now);
            if (due) {
              dueRefreshing = true;
              this.refreshAll().finally(() => { dueRefreshing = false; });
            }
          });
        },
        destroy() {
          if (this._onKey) document.removeEventListener("keydown", this._onKey);
          if (searchTimer) clearTimeout(searchTimer);
          this.opener.cancel();
        },
        onSearchInput(val, el) {
          const clipped = Array.from(String(val || "")).slice(0, 50).join("");
          if (el && el.value !== clipped) el.value = clipped;
          this.qInput = clipped;
          if (searchTimer) clearTimeout(searchTimer);
          // 搜索防抖计时器由共享外层持有，300ms 内切皮肤也不丢字、不断链
          searchTimer = setTimeout(() => {
            searchTimer = null;
            this.setQ(this.qInput);
          }, 300);
        },
        clearSearch() {
          if (searchTimer) { clearTimeout(searchTimer); searchTimer = null; }
          this.qInput = "";
          this.setQ("");
          this.$nextTick(() => {
            const input = document.querySelector('[data-testid="plaza-search"]');
            if (input) input.focus();
          });
        },
        setSort(s) {
          if (this.sort === s) return;
          this.sort = s;
          this.page = 1;
          this.fetchList();
        },
        setFilter(f) {
          if (this.filter === f) return;
          this.filter = f;
          this.page = 1;
          this.fetchList();
        },
        setQ(q) {
          this.q = q.trim();
          this.counts = null;
          this.page = 1;
          this.fetchList();
          this.fetchCounts();
        },
        setPage(p) {
          this.page = p;
          this.fetchList();
          this.scrollToPlaza();
        },
        scrollToPlaza(e) {
          if (e) e.preventDefault();
          const el = document.getElementById("plaza");
          if (el) el.scrollIntoView({ behavior: HT.fmt.reducedMotion() ? "auto" : "smooth", block: "start" });
        },
        async fetchList() {
          const my = ++listSeq;
          this.loading = true;
          this.error = null;
          this.items = [];
          this.pagination = null;
          this.writeQueryToUrl();
          try {
            const data = await HT.api.plaza({
              sort: this.sort,
              filter: this.filter,
              q: this.q.trim() || undefined,
              page: this.page,
              pageSize: this.pageSize,
            });
            if (my !== listSeq) return;
            this.items = data.items;
            this.pagination = data.pagination;
            this.loading = false;
          } catch (e) {
            if (my !== listSeq) return;
            // 新查询失败：清空旧卡片，显示本次错误和重试入口
            this.items = [];
            this.loading = false;
            this.error = (e && e.message) || "加载失败";
          }
        },
        writeQueryToUrl() {
          const url = new URL(window.location.href);
          if (this.sort === "new") url.searchParams.delete("sort");
          else url.searchParams.set("sort", this.sort);
          if (this.filter === "all") url.searchParams.delete("filter");
          else url.searchParams.set("filter", this.filter);
          if (!this.q) url.searchParams.delete("q");
          else url.searchParams.set("q", this.q);
          if (this.page === 1) url.searchParams.delete("page");
          else url.searchParams.set("page", this.page);
          if (url.href !== window.location.href) history.replaceState(history.state, "", url);
          const plazaQuery = new URLSearchParams();
          for (const key of ["sort", "filter", "q", "page"]) {
            if (url.searchParams.has(key)) plazaQuery.set(key, url.searchParams.get(key));
          }
          try { sessionStorage.setItem("hellotime.plazaQuery", plazaQuery.toString()); } catch {}
        },
        async fetchCounts() {
          const my = ++countSeq;
          try {
            const s = await HT.api.plazaStats(this.q.trim() || undefined);
            if (my === countSeq) this.counts = s.counts;
          } catch {}
        },
        async refreshAll() {
          await Promise.all([
            this.fetchList(),
            this.fetchCounts(),
            HT.api.plazaStats().then((o) => { this.overview = o; }).catch(() => {}),
            HT.api.plaza({ sort: "hot", filter: "unopened", page: 1, pageSize: 1 })
              .then((r) => { this.featured = r.items[0] || null; })
              .catch(() => {}),
          ]);
        },
        patchFavorited(id, favorited, count) {
          this.items.forEach((it) => {
            if (it.id === id) {
              it.favoritedByMe = favorited;
              it.favoriteCount = count;
            }
          });
          if (this.featured && this.featured.id === id) {
            this.featured.favoritedByMe = favorited;
            this.featured.favoriteCount = count;
          }
        },
        rankOf(i) {
          return this.sort === "hot" && this.page === 1 && !this.q.trim() && i < 3 ? i + 1 : 0;
        },
        isMine(nickname) {
          const u = Alpine.store("auth").user;
          return !!(u && u.nickname === nickname);
        },
        isOpened(c) {
          return !!(c.isOpened || HT.fmt.ms(c.openAt) <= Alpine.store("clock").now);
        },
        isFlipping(c) {
          return !c.isOpened && HT.fmt.ms(c.openAt) <= Alpine.store("clock").now;
        },
        pages() {
          return this.pagination ? pageNumbers(this.pagination.page, this.pagination.totalPages) : [];
        },
        farthestYear() {
          return this.overview && this.overview.farthestOpenAt ? new Date(this.overview.farthestOpenAt).getFullYear() : null;
        },
      };
    });

    /* ---------------- 开启页 ---------------- */
    Alpine.data("openPage", () => {
      const init = window.__HT_INIT__ || {};
      return {
        opener: makeCodeOpener(),
        mySealed: init.mySealed || [],
        destroy() {
          this.opener.cancel();
        },
        async pasteFromClipboard() {
          try {
            const t = cleanCode(await navigator.clipboard.readText()).slice(0, 8);
            if (!t) {
              Alpine.store("feedback").toast("剪贴板里没有胶囊码", { tone: "info" });
              return;
            }
            this.opener.setValue(t);
            if (t.length === 8) this.opener.go(t);
          } catch {
            Alpine.store("feedback").toast("粘贴失败：请允许浏览器访问剪贴板", { tone: "error" });
          }
        },
      };
    });
  });
})();
