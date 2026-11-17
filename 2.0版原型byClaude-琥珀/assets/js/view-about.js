/* ============================================================
   关于（/about）· 设计规范（/design，原型附页）· 404
   ============================================================ */
(function (HT) {
  'use strict';
  const { $, $$, esc, fmt, icon } = HT;

  HT.techIcon = (it, cls) => it.iconUrl
    ? `<img class="tech-ic${cls ? ' ' + cls : ''}" src="${it.iconUrl}" alt="" loading="lazy">`
    : `<span class="tech-ic tech-ic--txt${cls ? ' ' + cls : ''}" aria-hidden="true">${esc(it.name.replace(/[^A-Za-z]/g, '').slice(0, 2))}</span>`;

  function stackCard(kind, en, ic, title, path, items, summary) {
    return `<article class="card card--pad stack-card">
      <div class="eyebrow">${en}</div>
      <h2 class="card__title">${kind}<small class="mono">${path}</small></h2>
      <p class="card__lead">${summary}</p>
      <ul class="stack-list">
        ${items.map((it) => `<li>
          <span class="stack-list__ic">${HT.techIcon(it)}</span>
          <div><b>${esc(it.name)}<small class="mono">${esc(it.version || '')}</small></b><span>${esc(HT.TECH_NOTE[it.name] || '')}</span></div>
          <em>${HT.ROLE_LABEL[it.role] || it.role}</em>
        </li>`).join('')}
      </ul>
    </article>`;
  }

  function stacks() {
    const h = HT.api.health();
    return `<div class="about__live"><span class="ftr__dot"></span>后端在线 · <span class="mono">GET /api/v1/health</span> · <span class="mono">:9080 → ${h.backend.name} :${h.backend.port}</span></div>
      <div class="about__stacks">
        ${stackCard('前端', 'Frontend', 'code', 'React', 'frontends/react-ts', h.frontend, 'React Router 负责路由与守卫，Zustand 做轻量状态管理，Tailwind CSS v4 配合设计令牌承载整套视觉——切换主题只是切换一组变量。')}
        ${stackCard('后端', 'Backend', 'server', h.backend.name, `backends/${h.backend.key}`, h.backend.items, h.backend.summary)}
      </div>`;
  }

  const FEATURES = [
    ['user', '账号与头像', '邮箱注册即登录；十颗内置星球头像，昵称全站唯一。'],
    ['pen', '写一枚胶囊', '标题、正文、开启时间；没有头绪时，AI 给灵感，也能代笔。'],
    ['hourglass', '倒计时与自动开启', '没到时间只显示倒计时；归零的那一刻，胶囊自己打开。'],
    ['globe', '胶囊广场', '公开的胶囊陈列在这里，可搜索、筛选，按最新或最热排序。'],
    ['heart', '收藏与「我的」', '收藏别人的胶囊，等它开启；在「我的」里管理写过的每一枚。'],
    ['sparkle', '昼夜两套主题', '「星夜」与「晨曦」一键切换，并记住你的选择。'],
  ];

  HT.views = HT.views || {};
  HT.views.about = {
    title: '关于',
    render() {
      return `<div class="page page--about"><div class="container about">
        <header class="about__hero">
          <div class="about__badge"><span class="about__ring"></span>${HT.logo(112)}</div>
          <div>
            <div class="eyebrow">About</div>
            <h1 class="about__title">HelloTime Pro <span class="pill mono">v2.0</span></h1>
            <p class="about__motto">有些话，要等一等再说。</p>
            <p class="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
          </div>
        </header>

        <section class="about__sec">
          <div class="eyebrow">Tech stack</div>
          <h2 class="section-title">此刻运行的技术栈</h2>
          <p class="page-lead">页脚和这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
          <div id="stackHost">${stacks()}</div>
        </section>

        <section class="about__sec">
          <div class="eyebrow">Features</div>
          <h2 class="section-title">它能做什么</h2>
          <div class="features">${FEATURES.map(([ic, t, d], i) => `<article class="feature card" style="--i:${i}"><span class="feature__ic">${icon(ic)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
        </section>

        <section class="about__sec card card--pad dnotes">
          <div class="eyebrow">Design notes</div>
          <h2 class="section-title">设计手记</h2>
          <div class="dnotes__grid">
            <div><h3>琥珀与夜空</h3><p>琥珀能把一个瞬间完整封存千万年，所以它成了这里的主色；夜空与晨曦是时间流转的两面，于是有了「星夜」和「晨曦」两套主题。</p></div>
            <div><h3>一枚真正的「胶囊」</h3><p>胶囊的形状贯穿始终：导航栏、按钮、徽标都是它。合拢是封存中，两半分开、信纸升起就是已开启——不用读字也分得清。</p></div>
            <div><h3>每枚胶囊一种颜色</h3><p>颜色由胶囊码算出来，用 OKLCH 只变色相、不变明暗，同一个码永远是同一种颜色，广场上一眼望去像一排真正的胶囊。</p></div>
          </div>
        </section>

        <section class="about__sec about__credits">
          <div><h3>${icon('code')}源码</h3><p>实现位于仓库的 <code class="mono">frontends/react-ts</code> 与 <code class="mono">backends/</code> 目录。</p><a class="link-btn" href="#/about" data-noop>在 GitHub 上查看${icon('external')}</a></div>
          <div><h3>${icon('heart')}致谢</h3><p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p></div>
          <div><h3>${icon('book')}许可</h3><p>MIT License。本项目用于教学与研究，不面向生产环境。</p></div>
        </section>
      </div></div>`;
    },
    mount(page) {
      const off = HT.bus.on('backend', () => { $('#stackHost', page).innerHTML = stacks(); });
      page.addEventListener('click', (e) => { if (e.target.closest('[data-noop]')) { e.preventDefault(); HT.toast('原型里没有接入真实链接', { type: 'info' }); } });
      return off;
    },
  };

  /* ---------------- 设计规范（原型附页） ---------------- */
  const SW = [
    ['底与面', [['--bg', '页面底'], ['--bg-elevated', '抬升面'], ['--card-solid', '卡片'], ['--field', '输入底']]],
    ['文字', [['--text', '主文字'], ['--text-2', '次文字'], ['--text-3', '辅助']]],
    ['强调', [['--amber', '琥珀 · 主色'], ['--violet', '星紫 · 封存中'], ['--cyan', '晴青 · 公开'], ['--success', '松绿 · 已开启'], ['--danger', '绯红 · 危险']]],
  ];
  const CODES = ['GK25WIND', 'SAMESONG', 'Y2030NEW', 'BEIJING1', 'GUIHUA24', 'TENYEARS', 'KAOYAN27', 'CAT00100'];

  HT.views.design = {
    title: '设计规范',
    render() {
      const all = HT.api.plaza({ pageSize: 30 }).items;
      const sealed = all.find((c) => !c.isOpened), opened = all.find((c) => c.isOpened);
      return `<div class="page page--design"><div class="container design">
        <header class="page-head">
          <div class="eyebrow">Design language</div>
          <h1 class="page-title">「琥珀与夜空」设计规范</h1>
          <p class="page-lead">琥珀能把一个瞬间封存千万年——它是主色；夜空与晨曦是时间的两面——它们是两套主题。所有颜色、圆角、阴影都是变量，切换主题只是切换一组变量。</p>
        </header>

        <section class="ds card card--pad">
          <h2 class="card__title">胶囊 · 全站的母题</h2>
          <div class="ds__caps">
            <figure>${HT.capsuleArt('SAMESONG', 'locked', 220)}<figcaption><b>合拢</b>封存中：两半扣紧，接缝上的锁点在呼吸</figcaption></figure>
            <figure>${HT.capsuleArt('SAMESONG', 'opened', 220)}<figcaption><b>打开</b>已开启：两半分开、微微上扬，信纸从中间升起</figcaption></figure>
            <figure class="ds__try"><div id="dsToggle">${HT.capsuleArt('Y2030NEW', 'locked', 220)}</div><figcaption><b>切换</b>只改一个 class，过渡由 CSS 完成<button class="btn btn--soft btn--sm" type="button" data-toggle-art>${icon('refresh')}开 / 合</button></figcaption></figure>
          </div>
          <h3 class="ds__h">每枚胶囊一种颜色 <small>由胶囊码哈希出色相，OKLCH 固定亮度与彩度</small></h3>
          <div class="ds__palette">${CODES.map((k) => `<div>${HT.capsuleArt(k, 'locked', 120)}<span class="mono">${k}</span></div>`).join('')}</div>
        </section>

        <section class="ds card card--pad">
          <h2 class="card__title">色彩 <small>星夜 / 晨曦两套主题只替换这一组变量</small></h2>
          ${SW.map(([g, items]) => `<div class="ds__sw"><div class="ds__sw-k">${g}</div><div class="ds__sw-row">${items.map(([v, n]) => `<div class="sw"><i style="background:var(${v})"></i><b class="mono">${v}</b><em>${n}</em></div>`).join('')}</div></div>`).join('')}
          <div class="ds__sw"><div class="ds__sw-k">品牌渐变</div><div class="ds__grad"></div></div>
        </section>

        <section class="ds card card--pad">
          <h2 class="card__title">组件</h2>
          <div class="ds__row">
            <button class="btn btn--primary" type="button">${icon('pen')}主按钮</button>
            <button class="btn btn--ghost" type="button">次按钮${icon('arrow')}</button>
            <button class="btn btn--soft" type="button">柔和按钮</button>
            <button class="btn btn--danger-ghost" type="button">危险操作</button>
          </div>
          <div class="ds__row">
            ${HT.badge('locked', 'lock', '封存中')}${HT.badge('opened', 'mail', '已开启')}${HT.badge('plaza', 'globe', '广场公开')}${HT.badge('private', 'lock', '仅凭码可见')}${HT.badge('hot', 'fire', '热度 No.1')}${HT.badge('amber', 'clock', '一年后')}
            <span class="chip is-active">一年后</span><span class="chip">十年后</span>
          </div>
          <div class="ds__row">
            <div class="seg" id="dsSeg"><span class="seg__thumb"></span><button class="seg__opt is-active" type="button">全部<sup>27</sup></button><button class="seg__opt" type="button">封存中<sup>16</sup></button><button class="seg__opt" type="button">已开启<sup>11</sup></button></div>
            <span class="switch" role="switch" aria-checked="true" tabindex="0" data-ds-switch></span>
            ${HT.avatar('neo', 'av--lg')}${HT.avatar('pulse', 'av--lg')}${HT.avatar('nova', 'av--lg')}${HT.avatar('oracle', 'av--lg')}
          </div>
          <div class="ds__row ds__row--wide">
            <div>${HT.codeInput('md')}</div>
            <div class="ds__cd" id="dsCd">${HT.countdownHTML()}</div>
            ${HT.stamp(Date.now(), '已开启', 'stamp--demo')}
          </div>
          <div class="ds__cards">${sealed ? HT.card(sealed) : ''}${opened ? HT.card(opened, { i: 1 }) : ''}</div>
        </section>

        <section class="ds card card--pad">
          <h2 class="card__title">动效与交互</h2>
          <ul class="ds__motion">
            <li><b>时间表盘</b><span>首页主视觉的三层圆环以不同速度反向旋转，年份环缓缓流过；鼠标移动时整个表盘带一点立体视差。</span></li>
            <li><b>粒子背景</b><span>星夜是闪烁的星星和偶尔划过的流星，晨曦是阳光里上浮的金色微尘；标签页切到后台时暂停绘制。</span></li>
            <li><b>昼夜切换</b><span>顶栏的小天窗：月亮滑到另一侧变成太阳、云朵飘进来；整页从点击处圆形晕开。</span></li>
            <li><b>8 格码输入</b><span>一个透明的原生输入框盖在 8 个格子上，键盘、粘贴、输入法都自然可用；填入的字会弹一下，输满自动开启。</span></li>
            <li><b>开启</b><span>倒计时逐位落下；归零时胶囊抖动、两半分开、迸出一团光，信纸自上而下展开，邮戳「啪」地盖上。</span><a class="link-btn" href="#/c/${(HT.api.featured() || {}).code || 'SAMESONG'}">去看看${icon('arrow')}</a></li>
            <li><b>封存</b><span>信纸落进胶囊、两半合拢，8 位码牌随后逐个翻出。</span><a class="link-btn" href="#/create">去看看${icon('arrow')}</a></li>
            <li><b>卡片翻面</b><span>广场卡片的状态由「开启时间 vs 此刻」实时算出，倒计时归零的那一秒，卡片上的胶囊当场打开。</span></li>
            <li><b>克制</b><span>系统设置了「减少动态效果」时，所有动画降级为直接切换，粒子只画一帧。</span></li>
          </ul>
        </section>
      </div></div>`;
    },
    mount(page) {
      HT.seg($('#dsSeg', page), () => {});
      HT.bindCodeInput($('[data-code-input]', page), {});
      const target = Date.now() + (3 * 86400 + 5 * 3600 + 42 * 60 + 9) * 1000;
      HT.paintCountdown($('.cd', page), target, Date.now());
      const off = HT.tick.on((now) => HT.paintCountdown($('.cd', page), target, now));
      page.addEventListener('click', (e) => {
        if (e.target.closest('[data-toggle-art]')) { const a = $('#dsToggle .cart', page); a.classList.toggle('cart--locked'); a.classList.toggle('cart--opened'); }
        const sw = e.target.closest('[data-ds-switch]');
        if (sw) sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true'));
      });
      return off;
    },
  };

  /* ---------------- 404 ---------------- */
  HT.views.notfound = {
    title: '走丢了',
    render() {
      return `<div class="page"><div class="container"><div class="notice card">
        <div class="notice__float">${HT.capsuleArt('NOWHERE0', 'opened', 220)}</div>
        <div class="eyebrow eyebrow--center">404</div>
        <h1 class="page-title">这一页飘走了</h1>
        <p class="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
        <div class="notice__act"><a class="btn btn--primary" href="#/">回到广场</a><a class="btn btn--ghost" href="#/open">${icon('key')}凭码开启</a></div>
      </div></div></div>`;
    },
  };
})(window.HT);
