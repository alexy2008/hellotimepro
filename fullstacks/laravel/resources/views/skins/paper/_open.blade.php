@php
  use App\Support\UiHelper;
@endphp
<div class="page page--open">
  <div class="wrap openp">
    <div class="openp__poem" aria-hidden="true">
      <span>云中谁寄锦书来</span>
      <i></i>
      <small>李清照 ·《一剪梅》</small>
    </div>
    <section class="openp__main">
      <div class="overline"><i></i>Open a capsule</div>
      <h1 class="h1">凭码开启</h1>
      <p class="lede">
        输入朋友分享给你的 8 位胶囊码。<br>
        如果还没到启封的时刻，你会看到它的倒计时。
      </p>

      @include('skins.paper._code-input', ['size' => '', 'autoFocus' => true, 'idAttr' => 'code'])
      <div class="openp__err" role="alert" :data-testid="opener.error ? 'open-error' : null" x-text="opener.error"></div>

      <div class="openp__act">
        <button
          class="btn btn--primary btn--lg"
          :class="opener.state === 'checking' ? 'is-busy' : ''"
          type="button"
          :disabled="opener.value.length !== 8 || opener.state === 'checking'"
          @click="opener.go(opener.value)"
        >
          {!! UiHelper::icon('key') !!}
          <span>开启</span>
          {!! UiHelper::icon('arrow', 'ic--go') !!}
        </button>
        <button class="btn btn--ghost btn--lg" type="button" @click="pasteFromClipboard()">
          {!! UiHelper::icon('paste') !!}
          粘贴识别
        </button>
      </div>

      <ul class="openp__tips">
        <li>
          {!! UiHelper::icon('link') !!}
          <span>也可以直接访问 <code class="mono">/capsules/&lt;胶囊码&gt;</code></span>
        </li>
        <li>
          {!! UiHelper::icon('lock') !!}
          <span>没有发布到广场的胶囊，同样可以凭码开启</span>
        </li>
      </ul>

      <template x-if="$store.auth.user && mySealed.length">
        <section class="mylist" data-testid="my-sealed">
          <header>
            <h2 class="serif">我封存过的胶囊</h2>
            <a class="link" href="/me/created">全部{!! UiHelper::icon('arrow') !!}</a>
          </header>
          <ul>
            <template x-for="c in mySealed" :key="c.id">
              <li>
                <a class="mylist__row" :href="`/capsules/${c.code}`" data-testid="my-sealed-item" :data-code="c.code" :data-state="c.isOpened ? 'opened' : 'sealed'">
                  <span :class="`seal seal--${c.isOpened ? 'line' : 'solid'}`" aria-hidden="true" x-text="c.isOpened ? '启' : '封'"></span>
                  <span class="mylist__info">
                    <b class="serif" x-text="c.title"></b>
                    <span class="mono" x-text="c.code"></span>
                  </span>
                  <span class="mylist__st" x-text="c.isOpened ? '已开启' : '距启封 ' + HT.fmt.span(HT.fmt.ms(c.openAt) - $store.clock.now)"></span>
                  {!! UiHelper::icon('chev-right') !!}
                </a>
              </li>
            </template>
          </ul>
        </section>
      </template>
    </section>
  </div>
</div>
