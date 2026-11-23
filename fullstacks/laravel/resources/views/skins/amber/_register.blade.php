@php
  use App\Support\UiHelper;
@endphp
<div class="page page--auth">
  <div class="container auth">
    <div class="auth__card auth__card--wide card">
      <div class="auth__art" aria-hidden="true">
        <span class="auth__orbit"></span>
        <span class="auth__orbit auth__orbit--2"></span>
        <span style="display:contents" x-html="HT.capsuleArtSvg(null, 'opened', 180)"></span>
      </div>
      <div class="eyebrow eyebrow--center">Create account</div>
      <h1 class="page-title">领一个身份</h1>
      <p class="page-lead">挑一颗星球当头像，然后写下你的第一枚胶囊。</p>

      <form novalidate @submit.prevent="submit()">
        <div class="form__row">
          <div class="field" :class="errors.email ? 'is-error' : ''" data-field="email">
            <div class="field__head"><label class="field__label" for="email">邮箱<em> *</em></label></div>
            <div class="input-wrap input-wrap--icon">
              {!! UiHelper::icon('mail', 'input-wrap__icon') !!}
              <input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com" aria-describedby="email-hint" :aria-invalid="errors.email ? 'true' : null" data-testid="register-email" :value="email" @input="email = $event.target.value" x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 380)">
            </div>
            <div class="field__hint" id="email-hint" :data-testid="errors.email ? 'field-error' : null" :data-field="errors.email ? 'email' : null" x-text="errors.email || '作为登录账号，注册后不可修改。'"></div>
          </div>

          <div class="field" :class="(errors.nickname || ns.state === 'invalid') ? 'is-error' : ''" data-field="nickname">
            <div class="field__head"><label class="field__label" for="nickname">昵称<em> *</em></label></div>
            <div class="input-wrap input-wrap--icon input-wrap--action">
              {!! UiHelper::icon('user', 'input-wrap__icon') !!}
              <input class="input" id="nickname" name="nickname" type="text" autocomplete="nickname" placeholder="2–20 个字符" aria-describedby="nickname-hint" :aria-invalid="(errors.nickname || ns.state === 'invalid') ? 'true' : null" data-testid="register-nickname" :value="nickname" @input="setNickname($event.target.value)">
              <span
                class="input-wrap__action nick-state"
                :class="ns.state === 'valid' ? 'is-good' : (ns.state === 'invalid' || ns.state === 'taken') ? 'is-bad' : ''"
                aria-hidden="true"
                :data-testid="ns.state ? 'nickname-state' : null"
                :data-state="ns.state || null"
                x-html="ns.state === 'valid' ? HT.iconSvg('check') : (ns.state === 'invalid' || ns.state === 'taken') ? HT.iconSvg('x') : ''"
              ></span>
            </div>
            <div class="field__hint" id="nickname-hint" :data-testid="(errors.nickname || ns.state === 'invalid') ? 'field-error' : null" :data-field="(errors.nickname || ns.state === 'invalid') ? 'nickname' : null" x-text="errors.nickname || (ns.state === 'invalid' ? ns.hint : (ns.hint || '全站唯一，注册后可以改。'))"></div>
          </div>
        </div>

        <div class="field" :class="errors.password ? 'is-error' : ''" data-field="password">
          <div class="field__head"><label class="field__label" for="password">密码<em> *</em></label></div>
          <div class="input-wrap input-wrap--icon input-wrap--action">
            {!! UiHelper::icon('lock', 'input-wrap__icon') !!}
            <input class="input" id="password" name="password" :type="showPwd ? 'text' : 'password'" autocomplete="new-password" placeholder="设置密码" aria-describedby="password-hint" :aria-invalid="errors.password ? 'true' : null" data-testid="register-password" :value="password" @input="password = $event.target.value">
            <button class="input-wrap__action icon-btn" type="button" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
              <span style="display:contents" x-html="HT.iconSvg(showPwd ? 'eye-off' : 'eye')"></span>
            </button>
          </div>
          <div class="field__hint" id="password-hint" :data-testid="errors.password ? 'field-error' : null" :data-field="errors.password ? 'password' : null" x-text="errors.password || ''"></div>
        </div>

        <ul class="rules" aria-hidden="true">
          <li :class="pwdR.len ? 'is-ok' : ''">至少 8 位</li>
          <li :class="pwdR.alpha ? 'is-ok' : ''">含字母</li>
          <li :class="pwdR.digit ? 'is-ok' : ''">含数字</li>
        </ul>

        <div class="field field--plain">
          <div class="field__head">
            <span class="field__label">头像 <em>*</em></span>
            <span class="field__count">十选一，不支持上传</span>
          </div>
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
                <span style="display:contents" x-html="HT.avatarHtml(id, 'av--xl')"></span>
                <span x-text="HT.avatarOf(id).name"></span>
              </button>
            </template>
          </div>
          <div class="avpick__cap">
            <span style="display:contents" x-html="HT.avatarHtml(avatarId)"></span>
            <b x-text="HT.avatarOf(avatarId).name"></b>
            <span x-text="HT.avatarOf(avatarId).tagline"></span>
          </div>
        </div>

        <div class="form__err" role="alert" x-text="errors.form || errors.avatarId || ''"></div>

        <button class="btn btn--primary btn--lg btn--block" :class="busy ? 'is-busy' : ''" type="submit" :disabled="busy" data-testid="register-submit">
          <span x-text="busy ? '正在创建…' : '创建账号，开始写胶囊'"></span>
          {!! UiHelper::icon('arrow') !!}
        </button>
      </form>

      <p class="auth__alt">
        已经有账号？
        <a :href="loginHref()" data-testid="to-login">去登录</a>
      </p>
    </div>
  </div>
</div>
