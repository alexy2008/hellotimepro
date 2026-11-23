@php
  use App\Support\UiHelper;
@endphp
<div class="page page--auth">
  <div class="auth">
    <aside class="auth__art" aria-hidden="true">
      <div class="auth__brand">
        <svg class="logo" viewBox="0 0 28 28" aria-hidden="true">
          <rect width="28" height="28" rx="6" fill="var(--color-accent)"/>
          <path d="M6 9l8 7.5L22 9" fill="none" stroke="var(--color-on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="14" cy="17" r="2.6" fill="var(--color-on-accent)"/>
        </svg>
        <span class="latin">HelloTime</span>
      </div>
      <div class="auth__poem serif">
        <span>纸短情长</span>
        <span>来日方长</span>
      </div>
      <div class="auth__foot">
        <span>先留个名字，再慢慢写</span>
        <span class="seal seal--solid auth__seal" aria-hidden="true">缄</span>
      </div>
      <div class="auth__pm" x-html="HT.postmarkSvg(HT.fmt.date(Date.now()), '此 刻', 'pm--auth')"></div>
    </aside>

    <section class="auth__main">
      <div class="auth__card auth__card--wide">
        <div class="overline"><i></i>Sign up</div>
        <h1 class="h1">领一个信箱</h1>
        <p class="lede">挑一枚邮票当头像，然后写一封最早 1 分钟后才能打开的信。</p>

        <form novalidate @submit.prevent="submit()">
          <div class="form__row">
            <div class="field" :class="errors.email ? 'is-error' : ''" data-field="email">
              <label class="field__label" for="email">邮箱</label>
              <div class="field__box">
                <input class="field__input" id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="email-hint" :aria-invalid="errors.email ? 'true' : null" data-testid="register-email" :value="email" @input="email = $event.target.value" x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 380)">
                <span class="field__line"></span>
              </div>
              <div class="field__hint" id="email-hint" :data-testid="errors.email ? 'field-error' : null" :data-field="errors.email ? 'email' : null" x-text="errors.email || '作为登录账号，注册后不可修改。'"></div>
            </div>

            <div class="field" :class="(errors.nickname || ns.state === 'invalid') ? 'is-error' : ''" data-field="nickname">
              <label class="field__label" for="nickname">昵称</label>
              <div class="field__box">
                <input class="field__input" id="nickname" name="nickname" type="text" autocomplete="nickname" placeholder="2–20 个字符" aria-describedby="nickname-hint" :aria-invalid="(errors.nickname || ns.state === 'invalid') ? 'true' : null" data-testid="register-nickname" :value="nickname" @input="setNickname($event.target.value)">
                <span
                  class="field__state"
                  :class="ns.state === 'valid' ? 'is-good' : (ns.state === 'invalid' || ns.state === 'taken') ? 'is-bad' : ''"
                  aria-hidden="true"
                  :data-testid="ns.state ? 'nickname-state' : null"
                  :data-state="ns.state || null"
                  x-html="ns.state === 'valid' ? HT.iconSvg('check') : (ns.state === 'invalid' || ns.state === 'taken') ? HT.iconSvg('x') : ''"
                ></span>
                <span class="field__line"></span>
              </div>
              <div class="field__hint" id="nickname-hint" :data-testid="(errors.nickname || ns.state === 'invalid') ? 'field-error' : null" :data-field="(errors.nickname || ns.state === 'invalid') ? 'nickname' : null" x-text="errors.nickname || (ns.state === 'invalid' ? ns.hint : (ns.hint || '全站唯一，注册后可以改。'))"></div>
            </div>
          </div>

          <div class="field" :class="errors.password ? 'is-error' : ''" data-field="password">
            <label class="field__label" for="password">密码</label>
            <div class="field__box">
              <input class="field__input" id="password" name="password" :type="showPwd ? 'text' : 'password'" autocomplete="new-password" placeholder="设置密码" aria-describedby="password-hint" :aria-invalid="errors.password ? 'true' : null" data-testid="register-password" :value="password" @input="password = $event.target.value">
              <button class="field__eye" type="button" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
                <span style="display:contents" x-html="HT.iconSvg(showPwd ? 'eye-off' : 'eye')"></span>
              </button>
              <span class="field__line"></span>
            </div>
            <div class="field__hint" id="password-hint" :data-testid="errors.password ? 'field-error' : null" :data-field="errors.password ? 'password' : null" x-text="errors.password || ''"></div>
          </div>

          <ul class="rules" aria-hidden="true">
            <li :class="pwdR.len ? 'is-ok' : ''">至少 8 位</li>
            <li :class="pwdR.alpha ? 'is-ok' : ''">含字母</li>
            <li :class="pwdR.digit ? 'is-ok' : ''">含数字</li>
          </ul>

          <div class="field field--plain">
            <span class="field__label">邮票头像 <small>十选一，不支持上传</small></span>
            <div
              class="avpick"
              role="radiogroup"
              aria-label="选择头像"
              @keydown.arrow-right.prevent="moveAvatar(1, $el)"
              @keydown.arrow-down.prevent="moveAvatar(1, $el)"
              @keydown.arrow-left.prevent="moveAvatar(-1, $el)"
              @keydown.arrow-up.prevent="moveAvatar(-1, $el)"
            >
              <template x-for="id in avatarIds" :key="id">
                <button
                  type="button"
                  class="avpick__it"
                  :class="id === avatarId ? 'is-sel' : ''"
                  role="radio"
                  :aria-checked="id === avatarId ? 'true' : 'false'"
                  :tabindex="id === avatarId ? 0 : -1"
                  :aria-label="`${HT.avatarOf(id).name}，${HT.avatarOf(id).tagline}`"
                  data-testid="avatar-option"
                  :data-value="id"
                  :data-selected="id === avatarId ? 'true' : 'false'"
                  @click="avatarId = id"
                >
                  <span style="display:contents" x-html="HT.avatarStampHtml(id, '', true)"></span>
                  <svg class="avpick__cancel" viewBox="0 0 64 80" aria-hidden="true">
                    <circle cx="51" cy="65" r="14.5"/><circle cx="51" cy="65" r="10.5"/><path d="M45.5 65.5l4 4 7.5-8.5"/>
                  </svg>
                </button>
              </template>
            </div>
            <div class="avpick__cap">
              <b x-text="HT.avatarOf(avatarId).name"></b>
              <span x-text="HT.avatarOf(avatarId).tagline"></span>
            </div>
          </div>

          <div class="form__err" role="alert" x-text="errors.form || errors.avatarId || ''"></div>

          <button class="btn btn--primary btn--lg btn--block" :class="busy ? 'is-busy' : ''" type="submit" :disabled="busy" data-testid="register-submit">
            <span x-text="busy ? '正在创建…' : '创建账号，开始写信'"></span>
            {!! UiHelper::icon('arrow', 'ic--go') !!}
          </button>
        </form>

        <p class="auth__alt">
          已经有账号？
          <a class="link" :href="loginHref()" data-testid="to-login">去登录</a>
        </p>
      </div>
    </section>
  </div>
</div>
