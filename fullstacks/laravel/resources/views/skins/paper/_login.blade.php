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
        <span>见字如面</span>
        <span>展信安好</span>
      </div>
      <div class="auth__foot">
        <span>写信的人，在等回信的你</span>
        <span class="seal seal--solid auth__seal" aria-hidden="true">信</span>
      </div>
      <div class="auth__pm" x-html="HT.postmarkSvg(HT.fmt.date(Date.now()), '此 刻', 'pm--auth')"></div>
    </aside>

    <section class="auth__main">
      <div class="auth__card">
        <div class="overline"><i></i>Sign in</div>
        <h1 class="h1">欢迎回来</h1>
        <p class="lede">你留给未来的信，还在等你开启。</p>
        <template x-if="redirect">
          <p class="note note--inline">
            {!! UiHelper::icon('info') !!}
            <span>登录后会带你回到刚才的页面。</span>
          </p>
        </template>

        <form novalidate @submit.prevent="submit()" @input="clearFormErr()">
          <div class="field" :class="errors.email ? 'is-error' : ''" data-field="email">
            <label class="field__label" for="email">邮箱</label>
            <div class="field__box">
              <input class="field__input" id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="email-hint" :aria-invalid="errors.email ? 'true' : null" data-testid="login-email" :value="email" @input="email = $event.target.value" x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 380)">
              <span class="field__line"></span>
            </div>
            <div class="field__hint" id="email-hint" :data-testid="errors.email ? 'field-error' : null" :data-field="errors.email ? 'email' : null" x-text="errors.email || ''"></div>
          </div>

          <div class="field" :class="errors.password ? 'is-error' : ''" data-field="password">
            <label class="field__label" for="password">密码</label>
            <div class="field__box">
              <input class="field__input" id="password" name="password" :type="showPwd ? 'text' : 'password'" autocomplete="current-password" placeholder="输入密码" aria-describedby="password-hint" :aria-invalid="errors.password ? 'true' : null" data-testid="login-password" :value="password" @input="password = $event.target.value">
              <button class="field__eye" type="button" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
                <span style="display:contents" x-html="HT.iconSvg(showPwd ? 'eye-off' : 'eye')"></span>
              </button>
              <span class="field__line"></span>
            </div>
            <div class="field__hint" id="password-hint" :data-testid="errors.password ? 'field-error' : null" :data-field="errors.password ? 'password' : null" x-text="errors.password || '忘记密码？当前版本暂不支持找回。'"></div>
          </div>

          <div class="form__err" role="alert" :data-testid="errors.form ? 'login-error' : null" x-text="errors.form || ''"></div>

          <button class="btn btn--primary btn--lg btn--block" :class="busy ? 'is-busy' : ''" type="submit" :disabled="busy" data-testid="login-submit">
            <span x-text="busy ? '登录中…' : '登录'"></span>
            {!! UiHelper::icon('arrow', 'ic--go') !!}
          </button>
        </form>

        <p class="auth__alt">
          还没有账号？
          <a class="link" :href="registerHref()" data-testid="to-register">注册一个</a>
        </p>
      </div>
    </section>
  </div>
</div>
