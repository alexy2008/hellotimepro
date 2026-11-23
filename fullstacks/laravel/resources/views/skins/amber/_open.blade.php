@php
  use App\Support\UiHelper;
@endphp
<div class="page page--open">
  <div class="container open">
    <header class="page-head page-head--center">
      <div class="eyebrow">Open a capsule</div>
      <h1 class="page-title">开启胶囊</h1>
      <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
    </header>

    <form class="open__form card" novalidate @submit.prevent="opener.go(opener.value)">
      @include('skins.amber._code-input', ['size' => 'lg', 'autoFocus' => true])
      <div class="open__err" role="alert" :data-testid="opener.error ? 'open-error' : null" x-text="opener.error"></div>
      <button class="btn btn--primary btn--lg" :class="opener.state === 'checking' ? 'is-busy' : ''" type="submit">
        {!! UiHelper::icon('key') !!}开启胶囊
      </button>
      <p class="open__hint">
        胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。<br>
        没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/capsules/胶囊码</code>。
      </p>
    </form>

    <template x-if="$store.auth.user && mySealed.length">
      <section class="open__list" data-testid="my-sealed">
        <header>
          <h2>我封存过的胶囊</h2>
          <a class="link-btn" href="/me/created">全部{!! UiHelper::icon('arrow') !!}</a>
        </header>
        <ul>
          <template x-for="c in mySealed" :key="c.id">
            <li>
              <a
                class="crow"
                :href="`/capsules/${c.code}`"
                :style="`--glow:${HT.paletteOf(c.code).glow}`"
                data-testid="my-sealed-item"
                :data-code="c.code"
                :data-state="c.isOpened ? 'opened' : 'sealed'"
              >
                <span style="display:contents" x-html="HT.capsuleArtSvg(c.code, c.isOpened ? 'opened' : 'locked', 72)"></span>
                <span class="crow__info">
                  <b x-text="c.title"></b>
                  <span class="mono" x-text="c.code"></span>
                </span>
                <template x-if="c.isOpened">
                  <span class="badge badge--opened">{!! UiHelper::icon('mail') !!}已开启</span>
                </template>
                <template x-if="!c.isOpened">
                  <span class="badge badge--locked">{!! UiHelper::icon('lock') !!}<span x-text="`${HT.fmt.cdAmber(HT.fmt.ms(c.openAt), $store.clock.now)} 后`"></span></span>
                </template>
                {!! UiHelper::icon('chev-right', 'crow__go') !!}
              </a>
            </li>
          </template>
        </ul>
      </section>
    </template>
  </div>
</div>
