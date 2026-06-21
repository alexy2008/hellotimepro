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
    pickerHtml: '', pickerOpen: false, pickerPlacement: 'below', pickerMaxHeight: 460, pickerDraft: null, pickerViewMonth: null,
    init() {
      var o = this.$refs.openAt;
      var h = this.$refs.openAtHidden;
      if (o && !o.value && h && h.value) o.value = this.isoLocal(new Date(h.value));
      if (o && !o.value) o.value = this.isoLocal(new Date(Date.now() + 3600000));
      this.pickerDraft = this.localInputToDate(o && o.value);
      this.pickerViewMonth = new Date(this.pickerDraft.getFullYear(), this.pickerDraft.getMonth(), 1);
      this.onDocumentPointerdown = (event) => {
        if (this.pickerOpen && this.$refs.picker && !this.$refs.picker.contains(event.target)) {
          this.pickerOpen = false;
          this.renderPicker();
        }
      };
      this.onViewportMove = () => this.updatePickerPlacement();
      document.addEventListener('pointerdown', this.onDocumentPointerdown);
      window.addEventListener('resize', this.onViewportMove);
      window.addEventListener('scroll', this.onViewportMove, true);
      this.renderPicker();
      this.syncOpen();
      this.loadRecos();
    },
    destroy() {
      document.removeEventListener('pointerdown', this.onDocumentPointerdown);
      window.removeEventListener('resize', this.onViewportMove);
      window.removeEventListener('scroll', this.onViewportMove, true);
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
      else if (spec === 'y2030') { this.$refs.openAt.value = '2030-01-01T00:00'; this.syncPickerFromInput(); this.syncOpen(); return; }
      this.$refs.openAt.value = this.isoLocal(d);
      this.syncPickerFromInput();
      this.syncOpen();
    },
    pad2(n) { return (n < 10 ? '0' : '') + n; },
    localInputToDate(value) {
      var parsed = new Date(value || '');
      if (!isNaN(parsed.getTime())) return parsed;
      var fallback = new Date();
      fallback.setSeconds(0, 0);
      return fallback;
    },
    toLocalValue(date) {
      return date.getFullYear() + '-' + this.pad2(date.getMonth() + 1) + '-' + this.pad2(date.getDate()) + 'T' + this.pad2(date.getHours()) + ':' + this.pad2(date.getMinutes());
    },
    formatPickerDisplay(date) {
      return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日 ' + this.pad2(date.getHours()) + ':' + this.pad2(date.getMinutes());
    },
    formatPickerDistance(date) {
      var diffMinutes = Math.ceil((date.getTime() - Date.now()) / 60000);
      if (diffMinutes <= 0) return '已到开启时刻';
      if (diffMinutes < 60) return '距开启 ' + diffMinutes + ' 分钟';
      var hours = Math.floor(diffMinutes / 60);
      var minutes = diffMinutes % 60;
      if (hours < 24) return '距开启 ' + hours + ' 小时' + (minutes ? ' ' + minutes + ' 分钟' : '');
      var days = Math.floor(hours / 24);
      var restHours = hours % 24;
      if (days < 365) return '距开启 ' + days + ' 天' + (restHours ? ' ' + restHours + ' 小时' : '');
      var years = Math.floor(days / 365);
      var restDays = days % 365;
      return '距开启 ' + years + ' 年' + (restDays ? ' ' + restDays + ' 天' : '');
    },
    daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); },
    firstWeekdayFromMonday(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; },
    pickerPresetDate(spec) {
      var next = new Date();
      next.setSeconds(0, 0);
      if (spec === '1m') next.setMinutes(next.getMinutes() + 2);
      else if (spec === '1h') next.setHours(next.getHours() + 1);
      else if (spec === 'tomorrow9') { next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0); }
      else if (spec === '1y') next.setFullYear(next.getFullYear() + 1);
      else if (spec === 'y2030') return new Date(2030, 0, 1, 0, 0, 0, 0);
      return next;
    },
    syncPickerFromInput() {
      if (!this.$refs.openAt) return;
      this.pickerDraft = this.localInputToDate(this.$refs.openAt.value);
      this.pickerViewMonth = new Date(this.pickerDraft.getFullYear(), this.pickerDraft.getMonth(), 1);
      this.renderPicker();
    },
    commitPickerDraft(next) {
      this.pickerDraft = next;
      this.pickerViewMonth = new Date(next.getFullYear(), next.getMonth(), 1);
      this.renderPicker();
    },
    updatePickerPlacement() {
      if (!this.$refs.picker) return;
      var popover = this.$refs.picker.querySelector('.cy-dtp__popover');
      if (!popover) return;
      var gap = 8;
      var rect = this.$refs.picker.getBoundingClientRect();
      var spaceBelow = window.innerHeight - rect.bottom - gap;
      var spaceAbove = rect.top - gap;
      var popoverHeight = popover.offsetHeight;
      this.pickerPlacement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'above' : 'below';
      this.pickerMaxHeight = Math.max(160, Math.min(460, Math.floor(this.pickerPlacement === 'above' ? spaceAbove : spaceBelow)));
      popover.classList.toggle('cy-dtp__popover--above', this.pickerPlacement === 'above');
      popover.classList.toggle('cy-dtp__popover--below', this.pickerPlacement === 'below');
      popover.style.setProperty('--cy-dtp-max-height', this.pickerMaxHeight + 'px');
    },
    renderPicker() {
      if (!this.$refs.openAt || !this.pickerDraft || !this.pickerViewMonth) return;
      var inputDate = this.localInputToDate(this.$refs.openAt.value);
      var year = this.pickerViewMonth.getFullYear();
      var month = this.pickerViewMonth.getMonth();
      var html = '<button id="open_at_trigger" type="button" class="cy-dtp__trigger" aria-haspopup="dialog" aria-expanded="' + this.pickerOpen + '"><span class="cy-dtp__trigger-icon" aria-hidden="true">⏱</span><span class="cy-dtp__trigger-main"><span class="cy-dtp__trigger-value">' + this.formatPickerDisplay(inputDate) + '<span class="cy-dtp__trigger-hint">' + this.formatPickerDistance(inputDate) + '</span></span></span><span class="cy-dtp__trigger-chevron" aria-hidden="true">⌄</span></button>';
      if (this.pickerOpen) {
        var parts = {
          year: String(this.pickerDraft.getFullYear()),
          month: this.pad2(this.pickerDraft.getMonth() + 1),
          day: this.pad2(this.pickerDraft.getDate()),
          hour: this.pad2(this.pickerDraft.getHours()),
          minute: this.pad2(this.pickerDraft.getMinutes()),
        };
        html += '<div class="cy-dtp__popover cy-dtp__popover--' + this.pickerPlacement + '" style="--cy-dtp-max-height:' + this.pickerMaxHeight + 'px" role="dialog" aria-labelledby="open_at_title"><div class="cy-dtp__topbar"><div class="cy-dtp__summary"><span id="open_at_title" class="cy-dtp__eyebrow">选择开启时刻</span><strong>' + this.formatPickerDistance(this.pickerDraft) + '</strong></div><div class="cy-dtp__manual" aria-label="手动输入开启时间"><input aria-label="年份" inputmode="numeric" data-part="year" value="' + parts.year + '"><span>年</span><input aria-label="月份" inputmode="numeric" data-part="month" value="' + parts.month + '"><span>月</span><input aria-label="日期" inputmode="numeric" data-part="day" value="' + parts.day + '"><span>日</span><input aria-label="小时" inputmode="numeric" data-part="hour" value="' + parts.hour + '"><span>:</span><input aria-label="分钟" inputmode="numeric" data-part="minute" value="' + parts.minute + '"></div><div class="cy-dtp__actions"><button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" data-dtp-cancel>取消</button><button type="button" class="cy-btn cy-btn--primary cy-btn--sm" data-dtp-confirm>确认</button></div></div><div class="cy-dtp__panel"><div class="cy-dtp__calendar"><div class="cy-dtp__monthbar"><button type="button" aria-label="上个月" data-month="-1">‹</button><strong>' + year + '年' + (month + 1) + '月</strong><button type="button" aria-label="下个月" data-month="1">›</button></div><div class="cy-dtp__weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="cy-dtp__days">';
        for (var b = 0; b < this.firstWeekdayFromMonday(year, month); b++) html += '<span aria-hidden="true"></span>';
        for (var d = 1; d <= this.daysInMonth(year, month); d++) {
          var selected = this.pickerDraft.getFullYear() === year && this.pickerDraft.getMonth() === month && this.pickerDraft.getDate() === d;
          var today = new Date();
          var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
          html += '<button type="button" data-day="' + d + '" class="' + (selected ? 'is-selected ' : '') + (isToday ? 'is-today' : '') + '" aria-pressed="' + selected + '">' + d + '</button>';
        }
        html += '</div></div><div class="cy-dtp__time"><label>小时<select class="cy-select" data-time="hour">';
        for (var hr = 0; hr < 24; hr++) html += '<option value="' + hr + '"' + (this.pickerDraft.getHours() === hr ? ' selected' : '') + '>' + this.pad2(hr) + '</option>';
        html += '</select></label><label>分钟<select class="cy-select" data-time="minute">';
        for (var mi = 0; mi < 60; mi += 5) html += '<option value="' + mi + '"' + (this.pickerDraft.getMinutes() === mi ? ' selected' : '') + '>' + this.pad2(mi) + '</option>';
        var hourAngle = (this.pickerDraft.getHours() % 12) * 30 + this.pickerDraft.getMinutes() * 0.5;
        var minuteAngle = this.pickerDraft.getMinutes() * 6;
        html += '</select></label><div class="cy-dtp__clock" aria-label="标准时钟表盘" style="--cy-dtp-clock-hour-angle:' + hourAngle + 'deg;--cy-dtp-clock-minute-angle:' + minuteAngle + 'deg"><span class="cy-dtp__clock-hand cy-dtp__clock-hand--hour" aria-hidden="true"></span><span class="cy-dtp__clock-hand cy-dtp__clock-hand--minute" aria-hidden="true"></span><span class="cy-dtp__clock-center" aria-hidden="true"></span>';
        for (var ch = 1; ch <= 12; ch++) html += '<span class="' + (this.pickerDraft.getHours() % 12 === ch % 12 ? 'is-active' : '') + '" aria-label="' + ch + ' 点" style="transform:rotate(' + (ch * 30) + 'deg) translateY(-38px) rotate(' + (-ch * 30) + 'deg)">' + ch + '</span>';
        html += '</div></div></div><div class="cy-dtp__presets" aria-label="快速预设"><button type="button" data-dtp-preset="1m">1分钟后</button><button type="button" data-dtp-preset="1h">1小时后</button><button type="button" data-dtp-preset="tomorrow9">明天9:00</button><button type="button" data-dtp-preset="1y">1年后</button><button type="button" data-dtp-preset="y2030">2030.01.01</button></div></div>';
      }
      this.pickerHtml = html;
      if (this.pickerOpen) this.$nextTick(() => this.updatePickerPlacement());
    },
    normalizePickerManual() {
      var values = {};
      this.$refs.picker.querySelectorAll('[data-part]').forEach((el) => { values[el.dataset.part] = String(el.value || '').replace(/\D/g, ''); });
      var y = Math.min(9999, Math.max(1, Number(values.year) || this.pickerDraft.getFullYear()));
      var m = Math.min(12, Math.max(1, Number(values.month) || this.pickerDraft.getMonth() + 1));
      var d = Math.min(this.daysInMonth(y, m - 1), Math.max(1, Number(values.day) || this.pickerDraft.getDate()));
      var h = Math.min(23, Math.max(0, Number(values.hour) || 0));
      var min = Math.min(59, Math.max(0, Number(values.minute) || 0));
      this.commitPickerDraft(new Date(y, m - 1, d, h, min, 0, 0));
    },
    handlePickerClick(event) {
      var target = event.target;
      if (target.closest('.cy-dtp__trigger')) { this.pickerOpen = !this.pickerOpen; if (this.pickerOpen) this.syncPickerFromInput(); else this.renderPicker(); return; }
      if (target.closest('[data-dtp-cancel]')) { this.pickerOpen = false; this.syncPickerFromInput(); return; }
      if (target.closest('[data-dtp-confirm]')) { this.$refs.openAt.value = this.toLocalValue(this.pickerDraft); this.syncOpen(); this.pickerOpen = false; this.renderPicker(); return; }
      var monthBtn = target.closest('[data-month]');
      if (monthBtn) { this.pickerViewMonth = new Date(this.pickerViewMonth.getFullYear(), this.pickerViewMonth.getMonth() + Number(monthBtn.dataset.month), 1); this.renderPicker(); return; }
      var dayBtn = target.closest('[data-day]');
      if (dayBtn) { this.pickerDraft.setFullYear(this.pickerViewMonth.getFullYear(), this.pickerViewMonth.getMonth(), Number(dayBtn.dataset.day)); this.commitPickerDraft(new Date(this.pickerDraft)); return; }
      var presetBtn = target.closest('[data-dtp-preset]');
      if (presetBtn) this.commitPickerDraft(this.pickerPresetDate(presetBtn.dataset.dtpPreset));
    },
    handlePickerChange(event) {
      var target = event.target;
      if (target.matches("[data-time='hour']")) { this.pickerDraft.setHours(Number(target.value)); this.commitPickerDraft(new Date(this.pickerDraft)); }
      if (target.matches("[data-time='minute']")) { this.pickerDraft.setMinutes(Number(target.value)); this.commitPickerDraft(new Date(this.pickerDraft)); }
      if (target.matches('[data-part]')) this.normalizePickerManual();
    },
    handlePickerKeydown(event) {
      var part = event.target && event.target.dataset && event.target.dataset.part;
      if (!part || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      var delta = event.key === 'ArrowUp' ? 1 : -1;
      var next = new Date(this.pickerDraft);
      if (part === 'year') next.setFullYear(Math.min(9999, Math.max(1, next.getFullYear() + delta)));
      else if (part === 'month') next.setMonth(next.getMonth() + delta);
      else if (part === 'day') next.setDate(next.getDate() + delta);
      else if (part === 'hour') next.setHours(next.getHours() + delta);
      else next.setMinutes(next.getMinutes() + delta);
      this.commitPickerDraft(next);
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
        if (s.openAt && this.$refs.openAt) { this.$refs.openAt.value = this.isoLocal(new Date(s.openAt)); this.syncPickerFromInput(); this.syncOpen(); }
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
