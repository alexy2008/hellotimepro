document.addEventListener('alpine:init', () => {

  /* ── Theme store ── */
  Alpine.store('theme', {
    current: localStorage.getItem('theme') || 'dark',
    init() {
      document.documentElement.dataset.theme = this.current;
    },
    toggle() {
      this.current = this.current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = this.current;
      localStorage.setItem('theme', this.current);
    },
  });

  /* ── Countdown timer ── */
  Alpine.data('countdown', (openAt) => ({
    days: 0, hours: 0, minutes: 0, seconds: 0, _t: null,
    init() { this.tick(); this._t = setInterval(() => this.tick(), 1000); },
    tick() {
      var s = Math.max(0, Math.floor((new Date(openAt).getTime() - Date.now()) / 1000));
      this.days = Math.floor(s / 86400);
      this.hours = Math.floor((s % 86400) / 3600);
      this.minutes = Math.floor((s % 3600) / 60);
      this.seconds = s % 60;
    },
    pad(n) { return String(n).padStart(2, '0'); },
    get compactText() {
      return '⏳ 还剩 ' + this.days + ' 天 · ' + this.pad(this.hours) + ':' + this.pad(this.minutes) + ':' + this.pad(this.seconds);
    },
    destroy() { if (this._t) clearInterval(this._t); },
  }));

  /* ── Favorite button ── */
  Alpine.data('favButton', (capsuleId, authenticated, initialCount, initialActive) => ({
    active: initialActive, count: initialCount, loading: false,
    async toggle() {
      if (!authenticated) { if (confirm('登录后才能收藏，是否前往登录？')) location.href = '/login'; return; }
      if (this.loading) return;
      this.loading = true;
      try {
        var url = this.active ? '/api/v1/me/favorites/' + capsuleId : '/api/v1/me/favorites';
        var opts = { method: this.active ? 'DELETE' : 'POST', headers: { Accept: 'application/json' } };
        if (!this.active) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify({ capsuleId: capsuleId }); }
        var r = await fetch(url, opts);
        if (r.status < 200 || r.status >= 300) return;
        var env = r.status === 204 ? {} : await r.json().catch(function () { return {}; });
        this.active = !this.active;
        this.count = (env.data && typeof env.data.favoriteCount === 'number')
          ? env.data.favoriteCount
          : Math.max(0, this.count + (this.active ? 1 : -1));
      } catch (_) { /* ignore */ } finally { this.loading = false; }
    },
  }));

  /* ── 8-digit code input ── */
  Alpine.data('codeInput', () => ({
    d: ['', '', '', '', '', '', '', ''],
    onInput(i) {
      this.d[i] = this.d[i].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1);
      if (this.d[i] && i < 7) this.$nextTick(() => { var el = this.$refs['d' + (i + 1)]; if (el) el.focus(); });
      this.check();
    },
    onPaste(e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      t.split('').forEach((c, i) => { this.d[i] = c; });
      if (t.length) this.$nextTick(() => { var el = this.$refs['d' + Math.min(t.length, 7)]; if (el) el.focus(); });
      this.check();
    },
    check() { var c = this.d.join(''); if (/^[A-Z0-9]{8}$/.test(c)) location.href = '/c/' + c; },
  }));

  /* ── Create capsule form ── */
  Alpine.data('createCapsule', () => ({
    titleValue: '', aiLoading: false, aiGenerated: false, aiInfo: '', recos: [],
    init() {
      var o = this.$refs.openAt;
      if (o && !o.value) o.value = this.isoLocal(new Date(Date.now() + 3600000));
      this.syncOpen();
      this.loadRecos();
    },
    isoLocal(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); },
    syncOpen() {
      var v = this.$refs.openAt, h = this.$refs.openAtHidden;
      if (!v || !h) return;
      var d = new Date(v.value);
      h.value = isNaN(d.getTime()) ? '' : d.toISOString();
    },
    preset(spec) {
      var d = new Date();
      if (spec === '1m') d.setSeconds(d.getSeconds() + 130);
      else if (spec === '1h') d.setHours(d.getHours() + 1);
      else if (spec === 'tomorrow9') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
      else if (spec === '1y') d.setFullYear(d.getFullYear() + 1);
      else if (spec === 'y2030') { this.$refs.openAt.value = '2030-01-01T00:00'; this.syncOpen(); return; }
      this.$refs.openAt.value = this.isoLocal(d);
      this.syncOpen();
    },
    loadRecos() {
      fetch('/api/v1/capsule-recommendations?count=4', { headers: { Accept: 'application/json' } })
        .then(r => r.json()).then(env => { this.recos = (env.data && env.data.items) || []; }).catch(() => {});
    },
    applyReco(reco) {
      this.titleValue = reco.title || '';
      if (this.$refs.content) this.$refs.content.value = '';
      this.runAi(reco.title || '');
    },
    runAi(raw) {
      this.aiLoading = true; this.aiInfo = '';
      var t = (raw || '').trim(), auto = !t;
      fetch('/api/v1/capsule-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(t ? { title: t } : {}),
      }).then(r => r.json()).then(env => {
        var s = env.data || {};
        if (s.title && !t) this.titleValue = s.title;
        if (s.content && this.$refs.content) this.$refs.content.value = s.content;
        if (s.openAt && this.$refs.openAt) { this.$refs.openAt.value = this.isoLocal(new Date(s.openAt)); this.syncOpen(); }
        if (s.content) {
          var src = s.generatedBy === 'local-template' ? '本地模板（LLM 未启用）' : (s.generatedBy || '未知模型');
          var note = s.title && auto ? '标题与正文均由 AI 生成' : '已为你生成正文';
          this.aiInfo = note + '，建议 ' + (s.openInDays || 0) + ' 天后开启 · 来源：' + src;
          this.aiGenerated = true;
        }
      }).catch(() => {}).finally(() => { this.aiLoading = false; });
    },
    get showRecos() { return !this.titleValue.trim() && this.recos.length > 0; },
  }));

  /* ── Share / copy actions ── */
  Alpine.data('shareActions', (code) => ({
    copied: false,
    copyCode() {
      if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
      this.copied = true; setTimeout(() => { this.copied = false; }, 1200);
    },
    shareLink() {
      var url = location.origin + '/c/' + code;
      if (navigator.share) navigator.share({ title: 'HelloTime Pro 时间胶囊', url: url }).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    },
  }));

  /* ── Profile editor ── */
  Alpine.data('profileEditor', (initialNick, initialAvatar) => ({
    nickname: initialNick, selectedAvatar: initialAvatar, _nick: initialNick, _avatar: initialAvatar,
    saving: false, msg: '', msgType: '',
    oldPwd: '', newPwd: '', confirmPwd: '', pwdSaving: false, pwdMsg: '', pwdMsgType: '',
    showMsg(text, good) { this.msg = text; this.msgType = good ? 'cy-alert cy-alert--success' : 'cy-alert cy-alert--danger'; },
    showPwdMsg(text, good) { this.pwdMsg = text; this.pwdMsgType = good ? 'cy-alert cy-alert--success' : 'cy-alert cy-alert--danger'; },
    async saveProfile() {
      var payload = {};
      if (this.nickname !== this._nick) payload.nickname = this.nickname;
      if (this.selectedAvatar !== this._avatar) payload.avatarId = this.selectedAvatar;
      if (!Object.keys(payload).length) { this.showMsg('没有改动', true); return; }
      this.saving = true;
      try {
        var r = await fetch('/api/v1/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        var env = await r.json();
        if (env.success) {
          this.nickname = env.data.nickname; this.selectedAvatar = env.data.avatarId;
          this._nick = env.data.nickname; this._avatar = env.data.avatarId;
          var chip = document.querySelector('.cy-user-chip--button');
          if (chip) chip.setAttribute('title', env.data.nickname);
          this.showMsg('已保存', true);
        } else { this.showMsg(env.message || '保存失败', false); }
      } catch (_) { /* ignore */ } finally { this.saving = false; }
    },
    async savePassword() {
      if (this.newPwd !== this.confirmPwd) { this.showPwdMsg('两次输入的新密码不一致', false); return; }
      this.pwdSaving = true;
      try {
        var r = await fetch('/api/v1/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ currentPassword: this.oldPwd, newPassword: this.newPwd }) });
        if (r.status === 204) { this.oldPwd = this.newPwd = this.confirmPwd = ''; this.showPwdMsg('密码已更新', true); }
        else { var env = await r.json(); this.showPwdMsg(env.message || '更新失败', false); }
      } catch (_) { /* ignore */ } finally { this.pwdSaving = false; }
    },
  }));

  /* ── Avatar picker (register) ── */
  Alpine.data('avatarPicker', (initial) => ({ selected: initial }));

});
