@php
  use App\Support\UiHelper;
@endphp
<div class="page page--me">
  <div class="wrap me">
    <header class="me__head">
      <div class="me__id">
        <span style="display:contents" x-html="HT.avatarStampHtml($store.auth.user?.avatarId, 'stamp--lg', true)"></span>
        <div>
          <div class="overline"><i></i>My desk</div>
          <h1 class="h1" x-text="$store.auth.user?.nickname || ''"></h1>
          <p class="me__mail">
            <span class="mono" x-text="$store.auth.user?.email || ''"></span>
            <span x-text="$store.auth.user?.createdAt ? `${HT.fmt.cn(HT.fmt.ms($store.auth.user.createdAt))} 加入` : ''"></span>
          </p>
        </div>
      </div>
      <dl class="me__stats">
        <div data-testid="me-stat" data-key="created" :data-value="stats ? stats.created : ''">
          <dd class="latin" x-text="stats ? HT.fmt.num(stats.created) : '—'"></dd>
          <dt>写下的胶囊</dt>
        </div>
        <div data-testid="me-stat" data-key="unopened" :data-value="stats ? stats.unopened : ''">
          <dd class="latin" x-text="stats ? HT.fmt.num(stats.unopened) : '—'"></dd>
          <dt>还在等待启封</dt>
        </div>
        <div data-testid="me-stat" data-key="favoritesReceived" :data-value="stats ? stats.favoritesReceived : ''">
          <dd class="latin" x-text="stats ? HT.fmt.num(stats.favoritesReceived) : '—'"></dd>
          <dt>被收藏的次数</dt>
        </div>
      </dl>
    </header>

    <nav class="tabs" aria-label="我的" x-data="meTabsIndicator('.tabs__it.is-active', '.tabs__ink')">
      <a class="tabs__it" :class="tab === 'created' ? 'is-active' : ''" href="/me/created" :aria-current="tab === 'created' ? 'page' : null" data-testid="me-tab-created" :data-count="stats ? stats.created : null">
        我创建的<template x-if="stats"><sup x-text="stats.created"></sup></template>
      </a>
      <a class="tabs__it" :class="tab === 'favorites' ? 'is-active' : ''" href="/me/favorites" :aria-current="tab === 'favorites' ? 'page' : null" data-testid="me-tab-favorites" :data-count="stats ? stats.favoritesGiven : null">
        我收藏的<template x-if="stats"><sup x-text="stats.favoritesGiven"></sup></template>
      </a>
      <a class="tabs__it" :class="tab === 'profile' ? 'is-active' : ''" href="/me/profile" :aria-current="tab === 'profile' ? 'page' : null" data-testid="me-tab-profile">
        账号设置
      </a>
      <span class="tabs__ink" aria-hidden="true"></span>
      <button class="linkbtn tabs__out" type="button" @click="doLogout()">
        {!! UiHelper::icon('logout') !!}登出
      </button>
    </nav>

    <div class="me__body is-swap" :data-tab="tab">
      {{-- ======== 我创建的 ======== --}}
      <template x-if="tab === 'created'">
        <div style="display:contents">
          <template x-if="!items.length">
            <div class="empty empty--inline" data-testid="list-empty">
              <span class="seal seal--line" aria-hidden="true">空</span>
              <h3>还没有写下任何胶囊</h3>
              <p>第一封信，写给一年后的自己怎么样？</p>
              <a class="btn btn--primary" href="/create" @click="$store.feedback.goCreate($event)">{!! UiHelper::icon('pen') !!}写一枚胶囊</a>
            </div>
          </template>
          <template x-if="items.length">
            <div style="display:contents">
              <div class="me__bar">
                <span x-text="`按创建时间倒序 · 共 ${total} 枚`"></span>
                <a class="btn btn--primary btn--sm" href="/create" @click="$store.feedback.goCreate($event)">{!! UiHelper::icon('plus') !!}新建胶囊</a>
              </div>
              <ul class="ledger">
                <template x-for="(c, idx) in items" :key="c.id">
                  <li
                    class="ledger__row"
                    :style="`--i:${idx}`"
                    data-testid="my-capsule"
                    :data-code="c.code"
                    :data-state="isOpened(c) ? 'opened' : 'sealed'"
                    :data-in-plaza="c.inPlaza ? 'true' : 'false'"
                  >
                    <div class="ledger__seal">
                      <span :class="`seal seal--${isOpened(c) ? 'line' : 'solid'}`" aria-hidden="true" x-text="isOpened(c) ? '启' : '封'"></span>
                    </div>
                    <div class="ledger__main">
                      <a class="ledger__title serif" :href="`/capsules/${c.code}`" data-testid="row-open" x-text="c.title"></a>
                      <div class="ledger__sub">
                        <button class="ledger__code mono" type="button" title="点击复制胶囊码" @click="$store.feedback.copyText(c.code, `已复制胶囊码 ${c.code}`)">
                          <span x-text="c.code"></span>{!! UiHelper::icon('copy') !!}
                        </button>
                        <template x-if="c.inPlaza">
                          <span class="tag">{!! UiHelper::icon('globe') !!}广场公开</span>
                        </template>
                        <template x-if="!c.inPlaza">
                          <span class="tag tag--quiet">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
                        </template>
                        <span x-text="`封存于 ${HT.fmt.date(HT.fmt.ms(c.createdAt))}`"></span>
                      </div>
                    </div>
                    <template x-if="isOpened(c)">
                      <div class="ledger__when">
                        <span class="ledger__k">已启封</span>
                        <b x-text="HT.fmt.date(HT.fmt.ms(c.openAt))"></b>
                        <small x-text="`在途 ${HT.fmt.span(HT.fmt.ms(c.openAt) - HT.fmt.ms(c.createdAt))}`"></small>
                      </div>
                    </template>
                    <template x-if="!isOpened(c)">
                      <div class="ledger__when">
                        <span class="ledger__k">距启封</span>
                        <b>
                          <template x-if="HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d > 0">
                            <span><span class="latin" x-text="HT.fmt.num(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d)"></span> 天</span>
                          </template>
                          <template x-if="HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).d === 0">
                            <span class="mono" x-text="`${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).h)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).m)}:${HT.fmt.pad2(HT.fmt.cd(HT.fmt.ms(c.openAt), $store.clock.now).s)}`"></span>
                          </template>
                        </b>
                        <div class="scale" :style="`--p:${HT.fmt.progress(HT.fmt.ms(c.createdAt), HT.fmt.ms(c.openAt), $store.clock.now)}%`">
                          <i class="scale__fill"></i><i class="scale__mark"></i>
                        </div>
                      </div>
                    </template>
                    <div class="ledger__fav" :title="`被收藏 ${c.favoriteCount} 次`">
                      {!! UiHelper::icon('heart') !!}
                      <span class="latin" x-text="HT.fmt.num(c.favoriteCount)"></span>
                    </div>
                    <div class="ledger__act">
                      <a class="btn btn--text" :href="`/capsules/${c.code}`">查看</a>
                      <button class="btn btn--text btn--danger" type="button" data-testid="delete-capsule" @click="removeCapsule(c)">删除</button>
                    </div>
                  </li>
                </template>
              </ul>
              <template x-if="hasMore">
                <div class="list-more">
                  <button class="btn btn--ghost" :class="moreBusy ? 'is-busy' : ''" type="button" :disabled="moreBusy" data-testid="list-next" @click="loadMore()" x-text="moreBusy ? '加载中…' : `加载更多（还有 ${total - items.length} 枚）`"></button>
                </div>
              </template>
              <p class="me__fine">
                {!! UiHelper::icon('info') !!}
                胶囊的内容与开启时间封存后不可修改；你可以随时删除自己写的胶囊，无论它是否已经开启。
              </p>
            </div>
          </template>
        </div>
      </template>

      {{-- ======== 我收藏的 ======== --}}
      <template x-if="tab === 'favorites'">
        <div style="display:contents">
          <template x-if="!items.length">
            <div class="empty empty--inline" data-testid="list-empty">
              <span class="seal seal--line" aria-hidden="true">藏</span>
              <h3>还没有收藏</h3>
              <p>去广场看看别人写给未来的话，遇到想等的那一枚，就点亮它的心。</p>
              <a class="btn btn--primary" href="/">去广场逛逛{!! UiHelper::icon('arrow', 'ic--go') !!}</a>
            </div>
          </template>
          <template x-if="items.length">
            <div style="display:contents">
              <div class="me__bar">
                <span x-text="`按收藏时间倒序 · 共 ${total} 枚`"></span>
                <a class="btn btn--ghost btn--sm" href="/">去广场逛逛</a>
              </div>
              <div class="grid grid--me">
                <template x-for="(c, idx) in items" :key="c.id">
                  @include('skins.paper._card', [
                    'cardTestId' => 'fav-item',
                    'openTestId' => 'row-open',
                    'withRank' => false,
                    'favCallback' => '(id, f) => onFavChange(id, f)',
                  ])
                </template>
              </div>
              <template x-if="hasMore">
                <div class="list-more">
                  <button class="btn btn--ghost" :class="moreBusy ? 'is-busy' : ''" type="button" :disabled="moreBusy" data-testid="list-next" @click="loadMore()" x-text="moreBusy ? '加载中…' : `加载更多（还有 ${total - items.length} 枚）`"></button>
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>

      {{-- ======== 账号设置 ======== --}}
      <template x-if="tab === 'profile'">
        <div class="profile">
          <section class="pane">
            <h2 class="pane__h">基本信息</h2>
            <form novalidate @submit.prevent="saveProfile()">
              <div class="field" data-field="p-email">
                <label class="field__label" for="p-email">邮箱</label>
                <div class="field__box">
                  <input class="field__input" id="p-email" type="email" :value="$store.auth.user?.email || ''" disabled aria-describedby="p-email-hint">
                  <span class="field__state is-lock" aria-hidden="true">{!! UiHelper::icon('lock') !!}</span>
                  <span class="field__line"></span>
                </div>
                <div class="field__hint" id="p-email-hint">邮箱是登录账号，不可修改。</div>
              </div>

              <div class="field" :class="(profErrors.nickname || profNs.state === 'invalid') ? 'is-error' : ''" data-field="p-nick">
                <label class="field__label" for="p-nick">昵称</label>
                <div class="field__box">
                  <input class="field__input" id="p-nick" type="text" autocomplete="nickname" aria-describedby="p-nick-hint" :aria-invalid="profErrors.nickname ? 'true' : null" data-testid="profile-nickname" :value="nickname" @input="setProfNickname($event.target.value)">
                  <span
                    class="field__state"
                    :class="profNs.state === 'valid' ? 'is-good' : (profNs.state === 'invalid' || profNs.state === 'taken') ? 'is-bad' : ''"
                    aria-hidden="true"
                    :data-testid="profNs.state ? 'nickname-state' : null"
                    :data-state="profNs.state || null"
                    x-html="profNs.state === 'valid' ? HT.iconSvg('check') : (profNs.state === 'invalid' || profNs.state === 'taken') ? HT.iconSvg('x') : ''"
                  ></span>
                  <span class="field__line"></span>
                </div>
                <div class="field__hint" id="p-nick-hint" :data-testid="profErrors.nickname ? 'field-error' : null" :data-field="profErrors.nickname ? 'nickname' : null" x-text="profErrors.nickname || profNs.hint || '2–20 个字符，全站唯一。'"></div>
              </div>

              <div class="field field--plain">
                <span class="field__label">邮票头像</span>
                <div class="avpick" role="radiogroup" aria-label="选择头像" @keydown.arrow-right.prevent="moveAvatar(1, $el)" @keydown.arrow-down.prevent="moveAvatar(1, $el)" @keydown.arrow-left.prevent="moveAvatar(-1, $el)" @keydown.arrow-up.prevent="moveAvatar(-1, $el)">
                  <template x-for="id in avatarIds" :key="id">
                    <button type="button" class="avpick__it" :class="id === avatarId ? 'is-sel' : ''" role="radio" :aria-checked="id === avatarId ? 'true' : 'false'" :tabindex="id === avatarId ? 0 : -1" :aria-label="`${HT.avatarOf(id).name}，${HT.avatarOf(id).tagline}`" data-testid="avatar-option" :data-value="id" :data-selected="id === avatarId ? 'true' : 'false'" @click="avatarId = id">
                      <span style="display:contents" x-html="HT.avatarStampHtml(id, '', true)"></span>
                      <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true"><circle cx="51" cy="65" r="14.5"/><circle cx="51" cy="65" r="10.5"/><path d="M45.5 65.5l4 4 7.5-8.5"/></svg>
                    </button>
                  </template>
                </div>
                <div class="avpick__cap">
                  <b x-text="HT.avatarOf(avatarId).name"></b>
                  <span x-text="HT.avatarOf(avatarId).tagline"></span>
                </div>
              </div>

              <div class="form__msg" :class="profMsg ? `is-${profMsg.type}` : ''" role="status">
                <template x-if="profMsg">
                  <span style="display:contents">
                    <span style="display:contents" x-html="HT.iconSvg(profMsg.type === 'err' ? 'alert' : profMsg.type === 'ok' ? 'check' : 'info')"></span>
                    <span x-text="profMsg.text"></span>
                  </span>
                </template>
              </div>
              <div class="pane__act">
                <button class="btn btn--ghost" type="button" @click="resetProfile()">重置</button>
                <button class="btn btn--primary" :class="profBusy ? 'is-busy' : ''" type="submit" :disabled="profBusy" data-testid="profile-save">
                  <span x-text="profBusy ? '保存中…' : '保存更改'"></span>
                </button>
              </div>
            </form>
          </section>

          <section class="pane">
            <h2 class="pane__h">修改密码</h2>
            <form novalidate @submit.prevent="changePassword()">
              <div class="field" :class="pwdErrors.current ? 'is-error' : ''" data-field="pw-cur">
                <label class="field__label" for="pw-cur">当前密码</label>
                <div class="field__box">
                  <input class="field__input" id="pw-cur" :type="showCur ? 'text' : 'password'" autocomplete="current-password" data-testid="pwd-current" :value="pwdCurrent" @input="pwdCurrent = $event.target.value; delete pwdErrors.current">
                  <button class="field__eye" type="button" :aria-label="showCur ? '隐藏密码' : '显示密码'" @click="showCur = !showCur"><span style="display:contents" x-html="HT.iconSvg(showCur ? 'eye-off' : 'eye')"></span></button>
                  <span class="field__line"></span>
                </div>
                <div class="field__hint" :data-testid="pwdErrors.current ? 'field-error' : null" :data-field="pwdErrors.current ? 'current' : null" x-text="pwdErrors.current || ''"></div>
              </div>

              <div class="field" :class="pwdErrors.next ? 'is-error' : ''" data-field="pw-new">
                <label class="field__label" for="pw-new">新密码</label>
                <div class="field__box">
                  <input class="field__input" id="pw-new" :type="showNew ? 'text' : 'password'" autocomplete="new-password" data-testid="pwd-new" :value="pwdNew" @input="pwdNew = $event.target.value; delete pwdErrors.next">
                  <button class="field__eye" type="button" :aria-label="showNew ? '隐藏密码' : '显示密码'" @click="showNew = !showNew"><span style="display:contents" x-html="HT.iconSvg(showNew ? 'eye-off' : 'eye')"></span></button>
                  <span class="field__line"></span>
                </div>
                <div class="field__hint" :data-testid="pwdErrors.next ? 'field-error' : null" :data-field="pwdErrors.next ? 'new' : null" x-text="pwdErrors.next || ''"></div>
              </div>

              <ul class="rules" aria-hidden="true">
                <li :class="pwdR.len ? 'is-ok' : ''">至少 8 位</li>
                <li :class="pwdR.alpha ? 'is-ok' : ''">含字母</li>
                <li :class="pwdR.digit ? 'is-ok' : ''">含数字</li>
              </ul>

              <div class="field" :class="pwdErrors.confirm ? 'is-error' : ''" data-field="pw-again">
                <label class="field__label" for="pw-again">再输一次新密码</label>
                <div class="field__box">
                  <input class="field__input" id="pw-again" :type="showConfirm ? 'text' : 'password'" autocomplete="new-password" data-testid="pwd-confirm" :value="pwdConfirm" @input="pwdConfirm = $event.target.value; delete pwdErrors.confirm">
                  <button class="field__eye" type="button" :aria-label="showConfirm ? '隐藏密码' : '显示密码'" @click="showConfirm = !showConfirm"><span style="display:contents" x-html="HT.iconSvg(showConfirm ? 'eye-off' : 'eye')"></span></button>
                  <span class="field__line"></span>
                </div>
                <div class="field__hint" :data-testid="pwdErrors.confirm ? 'field-error' : null" :data-field="pwdErrors.confirm ? 'confirm' : null" x-text="pwdErrors.confirm || ''"></div>
              </div>

              <div class="form__msg" :class="pwdMsg ? `is-${pwdMsg.type}` : ''" role="status">
                <template x-if="pwdMsg">
                  <span style="display:contents">
                    <span style="display:contents" x-html="HT.iconSvg(pwdMsg.type === 'err' ? 'alert' : 'check')"></span>
                    <span x-text="pwdMsg.text"></span>
                  </span>
                </template>
              </div>
              <p class="pane__fine">
                {!! UiHelper::icon('info') !!}
                修改成功后，这个账号在所有设备上的登录都会失效，需要重新登录。
              </p>
              <div class="pane__act">
                <button class="btn btn--primary" :class="pwdBusy ? 'is-busy' : ''" type="submit" :disabled="pwdBusy" data-testid="pwd-submit">
                  <span x-text="pwdBusy ? '更新中…' : '更新密码'"></span>
                </button>
              </div>
            </form>
          </section>
        </div>
      </template>
    </div>
  </div>
</div>
