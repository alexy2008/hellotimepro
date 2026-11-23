@php
  use App\Support\UiHelper;
@endphp
<div class="page page--auth">
  <div class="container auth">
    <div class="auth__card card">
      <div class="auth__art" aria-hidden="true">
        <span class="auth__orbit"></span>
        <span class="auth__orbit auth__orbit--2"></span>
        <span style="display:contents" x-html="HT.capsuleArtSvg(null, 'locked', 180)"></span>
      </div>
      <div class="eyebrow eyebrow--center">Welcome back</div>
      <h1 class="page-title">欢迎回来</h1>
      <p class="page-lead">你封存的胶囊，还在等你回来开启。</p>
      <template x-if="redirect">
        <p class="tip">
          {!! UiHelper::icon('info') !!}
          <span>登录后会带你回到刚才的页面。</span>
        </p>
      </template>

      <form novalidate @submit.prevent="submit()" @input="clearFormErr()">
        <div class="field" :class="errors.email ? 'is-error' : ''" data-field="email">
          <div class="field__head"><label class="field__label" for="email">邮箱</label></div>
          <div class="input-wrap input-wrap--icon">
            {!! UiHelper::icon('mail', 'input-wrap__icon') !!}
            <input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="email-hint" :aria-invalid="errors.email ? 'true' : null" data-testid="login-email" :value="email" @input="email = $event.target.value" x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 380)">
          </div>
          <div class="field__hint" id="email-hint" :data-testid="errors.email ? 'field-error' : null" :data-field="errors.email ? 'email' : null" x-text="errors.email || ''"></div>
        </div>

        <div class="field" :class="errors.password ? 'is-error' : ''" data-field="password">
          <div class="field__head"><label class="field__label" for="password">密码</label></div>
          <div class="input-wrap input-wrap--icon input-wrap--action">
            {!! UiHelper::icon('lock', 'input-wrap__icon') !!}
            <input class="input" id="password" name="password" :type="showPwd ? 'text' : 'password'" autocomplete="current-password" placeholder="输入密码" aria-describedby="password-hint" :aria-invalid="errors.password ? 'true' : null" data-testid="login-password" :value="password" @input="password = $event.target.value">
            <button class="input-wrap__action icon-btn" type="button" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
              <span style="display:contents" x-html="HT.iconSvg(showPwd ? 'eye-off' : 'eye')"></span>
            </button>
          </div>
          <div class="field__hint" id="password-hint" :data-testid="errors.password ? 'field-error' : null" :data-field="errors.password ? 'password' : null" x-text="errors.password || '忘记密码？当前版本暂不支持找回。'"></div>
        </div>

        <div class="form__err" role="alert" :data-testid="errors.form ? 'login-error' : null" x-text="errors.form || ''"></div>

        <button class="btn btn--primary btn--lg btn--block" :class="busy ? 'is-busy' : ''" type="submit" :disabled="busy" data-testid="login-submit">
          <span x-text="busy ? '登录中…' : '登录'"></span>
          {!! UiHelper::icon('arrow') !!}
        </button>
      </form>

      <p class="auth__alt">
        还没有账号？
        <a :href="registerHref()" data-testid="to-register">注册一个</a>
      </p>
    </div>
  </div>
</div>
