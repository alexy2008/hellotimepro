/* ============================================================
   关于（/about）· 设计规范（/design，原型附页）· 404
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;

  const techIcon = (it, cls) => it.iconUrl
    ? `<img class="tech__ic${cls ? ' ' + cls : ''}" src="${it.iconUrl}" alt="" loading="lazy">`
    : `<span class="tech__ic tech__ic--txt${cls ? ' ' + cls : ''}" aria-hidden="true">${esc(it.name.replace(/[^A-Za-z一-龥]/g, '').slice(0, 2))}</span>`;
  HT.skin('paper').ui.techIcon = techIcon;

  function stackCard(kind, title, sub, items, summary) {
    return `<article class="spec">
      <header class="spec__head">
        <div><div class="spec__k">${kind}</div><h3 class="spec__t serif">${title}</h3></div>
        <span class="spec__sub mono">${sub}</span>
      </header>
      <ul class="spec__list">
        ${items.map((it) => `<li class="tech">
          ${techIcon(it)}
          <div class="tech__main"><b>${esc(it.name)}<small class="mono">${esc(it.version || '')}</small></b><span>${esc(HT.TECH_NOTE[it.name] || '')}</span></div>
          <em class="tech__role">${HT.ROLE_LABEL[it.role] || it.role}</em>
        </li>`).join('')}
      </ul>
      <p class="spec__sum">${summary}</p>
    </article>`;
  }

  function stackSection() {
    const h = HT.api.health();
    return `
      <div class="about__live"><span class="dot dot--on"></span>后端在线<i></i><span class="mono">GET /api/v1/health</span><i></i><span class="mono">:9080 → ${h.backend.name} :${h.backend.port}</span></div>
      <div class="about__stack">
        ${stackCard('前端', 'React', 'frontends/react-ts', h.frontend, 'React Router 负责路由与守卫，Zustand 做轻量状态管理，Tailwind CSS v4 配合设计令牌承载整套视觉——换主题只改变量，不动组件。')}
        ${stackCard('后端', h.backend.name, `backends/${h.backend.key}`, h.backend.items, h.backend.summary)}
      </div>`;
  }


  const V = HT.skin('paper').views;
  V.about = {
    title: '关于',
    render() {
      return `<div class="page page--about"><div class="wrap about">
        <header class="about__hero">
          <div class="overline"><i></i>About</div>
          <h1 class="about__title"><span>有些话，</span><span>要<em>等一等</em>再说<i class="about__stop"></i></span></h1>
          <div class="about__lede">
            <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
            <p>它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的前端与后端技术栈实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。</p>
          </div>
        </header>


        <section class="about__sec">
          <header class="sechead"><span class="sechead__no">壹</span><div><h2 class="h2">此刻运行的技术栈</h2><p>页脚与这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p></div></header>
          <div id="stackHost">${stackSection()}</div>
        </section>


        <section class="about__sec">
          <header class="sechead"><span class="sechead__no">贰</span><div><h2 class="h2">它能做什么</h2><p>一枚胶囊从写下到被读到，会经过的每一步。</p></div></header>
          <ol class="feats">${HT.ABOUT.features.map(([ic, t, d], i) => `<li style="--i:${i}"><span class="feats__no latin">${String(i + 1).padStart(2, '0')}</span><b class="serif">${t}</b><p>${d}</p></li>`).join('')}</ol>
        </section>

        <section class="about__sec">
          <header class="sechead"><span class="sechead__no">叁</span><div><h2 class="h2">四条原则</h2><p>这个仓库为什么长成现在的样子。</p></div></header>
          <ol class="tenets">${HT.ABOUT.tenets.map(([t, d]) => `<li><b class="serif">${t}</b><p>${d}</p></li>`).join('')}</ol>
        </section>

        <section class="about__sec about__sec--end">
          <div class="credits">
            <div><h3 class="serif">源码</h3><p>全部实现都在同一个仓库里，按 <code class="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录。</p><a class="link" href="#/about" data-noop>在 GitHub 上查看${icon('external')}</a></div>
            <div><h3 class="serif">致谢</h3><p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p></div>
            <div><h3 class="serif">许可</h3><p>MIT License。本项目用于教学、对比与研究，不面向生产环境。</p></div>
          </div>
        </section>
      </div></div>`;
    },
    mount(page) {
      const off = HT.bus.on('backend', () => {
        $('#stackHost', page).innerHTML = stackSection();
      });
      page.addEventListener('click', (e) => { if (e.target.closest('[data-noop]')) { e.preventDefault(); HT.toast('原型里没有接入真实链接', { type: 'info' }); } });
      return off;
    },
  };

  /* ---------------- 设计规范（原型附页） ---------------- */

  const SWATCHES = [
    { group: '纸 · Surface', items: [['--paper', '页面底'], ['--paper-2', '卡片 / 信纸'], ['--paper-3', '槽 / 输入底'], ['--paper-4', '分隔块']] },
    { group: '墨 · Text', items: [['--ink', '主文字'], ['--ink-2', '次文字'], ['--ink-3', '辅助'], ['--ink-4', '装饰 / 占位']] },
    { group: '印 · Accent', items: [['--seal', '朱砂 · 封缄与主强调'], ['--indigo', '黛蓝 · 已启封与链接'], ['--gold', '藤黄 · AI 与热度'], ['--pine', '松绿 · 成功']] },
  ];

  V.design = {
    title: '设计规范',
    render() {
      const sample = HT.api.plaza({ pageSize: 30 }).items;
      const sealed = sample.find((c) => !c.isOpened), opened = sample.find((c) => c.isOpened);
      const hot = HT.api.featured();
      return `<div class="page page--design"><div class="wrap design">
        <header class="pagehead">
          <div><div class="overline"><i></i>Design language</div><h1 class="h1">「时笺」设计规范</h1></div>
          <p class="lede">时间胶囊的本质是一封寄给未来的信。<br>所以这套界面只用三样东西说话：纸、墨、印。</p>
        </header>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">壹</span>理念</h2>
          <div class="ds__idea">
            <div><b class="serif">纸</b><p>界面是一张宣纸色的信笺：暖白的底、极细的线、几乎不存在的圆角。夜间模式不是「反色」，而是灯下的墨色。</p></div>
            <div><b class="serif">墨</b><p>标题用宋体，正文像写在红格信纸上；数字与西文用一套旧式衬线，码与时间用打字机体——像邮局的单据。</p></div>
            <div><b class="serif">印</b><p>全站只有一种强调色：朱砂。它只出现在真正重要的地方——封缄、收藏、当前位置。「封」是白文印，「启」是朱文印，不靠颜色也分得清。</p></div>
          </div>
        </section>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">贰</span>色彩<small>昼 / 夜两套主题只替换这一组变量</small></h2>
          ${SWATCHES.map((g) => `<div class="ds__sw"><div class="ds__sw-k">${g.group}</div><div class="ds__sw-row">${g.items.map(([v, note]) => `<div class="sw"><i style="background:var(${v})"></i><b class="mono">${v}</b><span data-var="${v}" class="mono"></span><em>${note}</em></div>`).join('')}</div></div>`).join('')}
        </section>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">叁</span>字体</h2>
          <div class="ds__type">
            <div class="ty"><div class="ty__s ty__s--song">把此刻，寄给未来</div><div class="ty__m"><b>思源宋体 · 900 / 700</b><span>标题、信的正文。笔画对比强，像刻出来的字。</span></div></div>
            <div class="ty"><div class="ty__s latin ty__s--latin">2030 · 365 <i>days</i></div><div class="ty__m"><b>Cormorant Garamond</b><span>倒计时、统计数字与西文点缀。</span></div></div>
            <div class="ty"><div class="ty__s mono ty__s--mono">NO. GK25WIND · 09:00</div><div class="ty__m"><b>IBM Plex Mono</b><span>胶囊码、时间戳、路径——一切「单据上的字」。</span></div></div>
            <div class="ty"><div class="ty__s ty__s--sans">封缄后不可修改，可随时撤回。</div><div class="ty__m"><b>系统黑体（苹方 / 雅黑）</b><span>界面文字与说明，保证小字号下的清晰。</span></div></div>
          </div>
        </section>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">肆</span>印记</h2>
          <div class="ds__marks">
            <figure>${HT.seal('封', 'solid', 'seal--xl')}<figcaption><b>白文印「封」</b>未开启</figcaption></figure>
            <figure>${HT.seal('启', 'line', 'seal--xl')}<figcaption><b>朱文印「启」</b>已开启</figcaption></figure>
            <figure>${HT.wax('封', 'wax--demo')}<figcaption><b>火漆</b>封缄的动作与凭证</figcaption></figure>
            <figure>${HT.postmark({ line1: fmt.date(Date.now()), line2: '此 刻', cls: 'pm--demo' })}<figcaption><b>邮戳</b>一个确定的时刻</figcaption></figure>
            <figure><div class="ds__scale">${HT.scale(37, 'scale--lg')}</div><figcaption><b>刻度尺</b>等待走了多远</figcaption></figure>
          </div>
          <div class="ds__stamps">${HT.AVATARS.map((a) => HT.stamp(a.id)).join('')}</div>
          <p class="ds__cap">十枚内置头像沿用规范里的 id 与名字，重绘成单线徽记，印在带齿孔的邮票上。</p>
        </section>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">伍</span>组件</h2>
          <div class="ds__comp">
            <div class="ds__row">
              <button class="btn btn--primary" type="button">${icon('pen')}<span>主按钮</span>${icon('arrow', 'ic--go')}</button>
              <button class="btn btn--ghost" type="button">次按钮</button>
              <button class="btn btn--seal" type="button">朱砂按钮</button>
              <button class="btn btn--text" type="button">文字按钮</button>
              <button class="btn btn--text btn--danger" type="button">危险操作</button>
            </div>
            <div class="ds__row">
              <div class="seg" id="dsSeg"><span class="seg__thumb"></span><button class="seg__opt is-active" type="button" data-val="a">最新</button><button class="seg__opt" type="button" data-val="b">最热</button><button class="seg__opt" type="button" data-val="c">全部<sup>27</sup></button></div>
              <span class="chip is-active">1 年后</span><span class="chip">10 年后</span>
              <span class="tag">${icon('globe')}广场公开</span><span class="tag tag--quiet">${icon('lock')}仅凭码可见</span>
              <label class="switch switch--bare"><input type="checkbox" checked><span class="switch__track"><i></i></span></label>
            </div>
            <div class="ds__cards">${sealed ? HT.card(sealed) : ''}${opened ? HT.card(opened) : ''}</div>
          </div>
        </section>

        <section class="ds">
          <h2 class="ds__h"><span class="sechead__no">陆</span>动效与交互</h2>
          <ul class="ds__motion">
            <li><b>长按封缄</b><span>创建页的提交不是一次点击，而是按住火漆约 1 秒——不可撤销的动作，值得一点仪式感。随后信纸入封、封舌合上、火漆落下，取信凭证滑出。</span><a class="link" href="#/create">去看看${icon('arrow')}</a></li>
            <li><b>时间标尺</b><span>一把对数刻度的尺，从「此刻」到「十年」。拖动、点按、方向键都可以，信封上的邮戳会跟着变；需要精确时再展开日历。</span><a class="link" href="#/create">去看看${icon('arrow')}</a></li>
            <li><b>启封</b><span>倒计时归零的那一刻：火漆裂开，封舌掀起露出朱红内衬，信纸升起，字迹逐段显影。详情页有「快进」可以立即体验。</span><a class="link" href="#/c/${hot ? hot.code : 'SAMESONG'}">去看看${icon('arrow')}</a></li>
            <li><b>AI 代笔</b><span>正文像被人一笔一笔写上信纸；标尺同时滑向 AI 建议的启封时刻。开始打字即可随时打断。</span><a class="link" href="#/create">去看看${icon('arrow')}</a></li>
            <li><b>昼夜切换</b><span>以点击处为圆心晕开（View Transitions），像一盏灯被拧亮或熄灭。</span></li>
            <li><b>克制</b><span>缓动统一为一条出场曲线；尊重「减少动态效果」的系统设置，此时所有仪式都退化为直接切换。</span></li>
          </ul>
        </section>
      </div></div>`;
    },
    mount(page) {
      const paint = () => {
        const cs = getComputedStyle(document.documentElement);
        $$('[data-var]', page).forEach((el) => { el.textContent = cs.getPropertyValue(el.dataset.var).trim().toUpperCase(); });
      };
      paint();
      HT.seg($('#dsSeg', page), () => {});
      const off = HT.bus.on('theme', paint);
      return off;
    },
  };

  /* ---------------- 404 ---------------- */
  V.notfound = {
    title: '查无此页',
    render() {
      return `<div class="page"><div class="wrap wrap--narrow detail"><div class="lost">
        <div class="lost__mark">${HT.seal('迷', 'line')}</div>
        <h1 class="h1">查无此页</h1>
        <p>这个地址没有对应的页面。<br>也许是链接抄错了一位，也许它从未存在过。</p>
        <div class="lost__act"><a class="btn btn--primary" href="#/">回到广场</a><a class="btn btn--ghost" href="#/open">${icon('key')}凭码开启</a></div>
      </div></div></div>`;
    },
  };
})(window.HT);
