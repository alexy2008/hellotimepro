@php
  use App\Support\UiHelper;
  $presets = [
    ['key' => '1m', 'label' => '1 分钟后'],
    ['key' => 'tm', 'label' => '明早 9 点'],
    ['key' => '1w', 'label' => '一周后'],
    ['key' => '1mo', 'label' => '一个月后'],
    ['key' => '1y', 'label' => '一年后'],
    ['key' => '5y', 'label' => '五年后'],
    ['key' => '10y', 'label' => '十年后'],
  ];
@endphp
<div class="page page--create">
  <div class="container">
    {{-- 封存完成回执 --}}
    <template x-if="created">
      <section
        x-data="amberSealed()"
        class="sealed card"
        :class="shown ? 'is-in' : ''"
        :style="`--glow:${HT.paletteOf(created.code).glow}`"
        data-testid="sealed-receipt"
        :data-code="created.code"
      >
        <div class="sealed__art" x-html="HT.capsuleArtSvg(created.code, shown ? 'locked' : 'opened', 260)"></div>
        <div class="eyebrow eyebrow--center">Sealed</div>
        <h1 class="page-title">封存完成</h1>
        <p class="page-lead" x-text="`下面这串胶囊码是开启它的钥匙，${created.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。'}`"></p>
        <div class="tiles mono" :aria-label="`胶囊码 ${created.code}`" data-testid="sealed-code">
          <template x-for="(ch, ci) in Array.from(created.code)" :key="ci">
            <span :class="`tile${ci === 4 ? ' has-gap' : ''}`" :style="`--i:${ci}`" x-text="ch"></span>
          </template>
        </div>
        <div class="sealed__act">
          <button class="btn btn--primary" type="button" data-testid="copy-code" @click="$store.feedback.copyText(created.code, `已复制胶囊码 ${created.code}`)">
            {!! UiHelper::icon('copy') !!}复制胶囊码
          </button>
          <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="$store.feedback.copyText(`${window.location.origin}/capsules/${created.code}`, '已复制链接')">
            {!! UiHelper::icon('link') !!}复制链接
          </button>
        </div>
        <dl class="sealed__meta">
          <div><dt>标题</dt><dd x-text="created.title"></dd></div>
          <div><dt>开启时间</dt><dd class="mono" x-text="HT.fmt.dashDateTime(HT.fmt.ms(created.openAt))"></dd></div>
          <div><dt>沉睡时长</dt><dd x-text="HT.fmt.span(HT.fmt.ms(created.openAt) - Date.now())"></dd></div>
          <div>
            <dt>属性</dt>
            <dd>
              <template x-if="created.inPlaza">
                <span class="badge badge--plaza">{!! UiHelper::icon('globe') !!}广场公开</span>
              </template>
              <template x-if="!created.inPlaza">
                <span class="badge badge--private">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
              </template>
            </dd>
          </div>
        </dl>
        <div class="sealed__links">
          <a class="link-btn" :href="`/capsules/${created.code}`" data-testid="receipt-view">查看这枚胶囊{!! UiHelper::icon('arrow') !!}</a>
          <button class="link-btn" type="button" data-testid="receipt-again" @click="again()">再写一枚{!! UiHelper::icon('plus') !!}</button>
          <a class="link-btn" href="/me/created">我创建的{!! UiHelper::icon('feather') !!}</a>
        </div>
      </section>
    </template>

    {{-- 表单与实时预览 --}}
    <template x-if="!created">
      <div style="display:contents">
        <header class="page-head">
          <div class="eyebrow">Seal a capsule</div>
          <h1 class="page-title">写一枚胶囊</h1>
          <p class="page-lead">写给未来的自己，或者某个还没出现的人。合上之后，在开启时间到来之前，没有任何人能读到它。</p>
        </header>

        <div class="create">
          <form class="create__form card" novalidate @submit.prevent="submit()">
            <div class="field" x-data="shakeOn('shake.title')" :class="shaking ? 'is-shake' : ''" data-field="title">
              <div class="field__head">
                <label class="field__label" for="title">标题 <em>*</em></label>
                <span class="field__count mono"><b x-text="titleLen"></b>/60</span>
              </div>
              <div class="input-wrap input-wrap--action">
                <input
                  class="input"
                  id="title"
                  autocomplete="off"
                  placeholder="给这枚胶囊起个名字"
                  data-testid="create-title"
                  :value="title"
                  @input="setTitle($event.target.value, $event.target)"
                  x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 380)"
                >
                <button
                  class="ai-btn"
                  :class="aiBusy ? 'is-busy' : ''"
                  type="button"
                  data-testid="ai-generate"
                  title="让 AI 代写正文并建议开启时间；标题留空时会顺便起个标题"
                  @click="aiWrite()"
                >
                  {!! UiHelper::icon('sparkle') !!}
                  <span x-text="aiBusy ? '代笔中…' : aiDone ? '重新代笔' : 'AI 代笔'"></span>
                </button>
              </div>
              <div class="field__error" role="alert" :data-testid="errors.title ? 'field-error' : null" data-field="title" x-text="errors.title"></div>
            </div>

            <div class="recos" :class="showRecos ? '' : 'is-hidden'" :data-testid="showRecos ? 'ai-reco' : null">
              <div class="recos__in">
                <div class="recos__head">
                  <span>{!! UiHelper::icon('sparkle') !!}没有头绪？从一个灵感开始</span>
                  <button class="link-btn" type="button" data-testid="reco-refresh" :disabled="recoBusy || aiBusy" @click="loadRecos()">
                    {!! UiHelper::icon('refresh') !!}
                    <span x-text="recoBusy ? '换一批中…' : '换一批'"></span>
                  </button>
                </div>
                <div class="recos__list">
                  <template x-for="(r, ri) in (showRecos ? recos : [])" :key="r.title">
                    <button
                      class="reco"
                      type="button"
                      :style="`--i:${ri}`"
                      data-testid="reco-chip"
                      :disabled="aiBusy"
                      @click="aiWrite(r.title)"
                    >
                      <b x-text="r.title"></b>
                      <span x-text="r.hint"></span>
                      <em>{!! UiHelper::icon('clock') !!}<span x-text="`${HT.fmt.span(r.openInDays * 86400000)}后`"></span></em>
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <div class="field" x-data="shakeOn('shake.content')" :class="shaking ? 'is-shake' : ''" data-field="content">
              <div class="field__head">
                <label class="field__label" for="content">内容 <em>*</em></label>
                <span class="field__count mono"><b x-text="HT.fmt.num(contentLen)"></b>/5000</span>
              </div>
              <div class="paper" :class="`${aiBusy ? 'is-ai' : ''} ${aiThinking ? 'is-thinking' : ''}`">
                <textarea
                  class="paper__text"
                  id="content"
                  rows="9"
                  placeholder="在这里写下想交给未来的话。&#10;可以是此刻的天气、正在读的书、一个小小的约定，&#10;或者只是一句：嘿，你还好吗？"
                  data-testid="create-content"
                  :value="content"
                  @input="setContent($event.target.value, $event.target)"
                  x-effect="content; $el.style.height = 'auto'; $el.style.height = Math.max($el.scrollHeight, 36 * 8) + 'px'"
                ></textarea>
                <div class="paper__think" aria-hidden="true"><i></i><i></i><i></i></div>
              </div>
              <div class="field__hint">
                <template x-if="aiNote">
                  <span class="ai-note">{!! UiHelper::icon('sparkle') !!}<span x-text="aiNote"></span></span>
                </template>
              </div>
              <div class="field__error" role="alert" :data-testid="errors.content ? 'field-error' : null" data-field="content" x-text="errors.content"></div>
            </div>

            <div class="field" x-data="shakeOn('shake.openAt')" :class="shaking ? 'is-shake' : ''" data-field="openAt">
              <div class="field__head">
                <label class="field__label" for="openAt">开启时间 <em>*</em></label>
                <span class="field__count">最早 1 分钟后 · 最晚 10 年内</span>
              </div>

              @include('skins.amber._datetime_picker')

              <div class="chips">
                @foreach($presets as $p)
                  <button
                    class="chip"
                    :class="preset === '{{ $p['key'] }}' ? 'is-active' : ''"
                    type="button"
                    data-testid="openat-preset"
                    data-preset="{{ $p['key'] }}"
                    data-value="{{ $p['key'] }}"
                    :data-selected="preset === '{{ $p['key'] }}' ? 'true' : 'false'"
                    @click="pickPreset('{{ $p['key'] }}')"
                  >{{ $p['label'] }}</button>
                @endforeach
              </div>
              <div class="field__error" role="alert" :data-testid="errors.openAt ? 'field-error' : null" data-field="openAt" x-text="errors.openAt"></div>
            </div>

            <label class="toggle-card" :class="inPlaza ? 'is-on' : ''">
              <span class="toggle-card__ic">{!! UiHelper::icon('globe') !!}</span>
              <span class="toggle-card__txt">
                <b>发布到胶囊广场</b>
                <small x-text="inPlaza ? '标题与昵称公开展示，内容到时间才可见' : '不出现在广场；把胶囊码交给谁，谁才能找到它'"></small>
              </span>
              <input type="checkbox" class="sr-only" :checked="inPlaza" data-testid="create-in-plaza" @change="setInPlaza($event.target.checked)">
              <span class="switch" aria-hidden="true"></span>
            </label>

            <div class="create__foot">
              <div class="create__sum">
                {!! UiHelper::icon('hourglass') !!}
                <template x-if="span > 0">
                  <span>将沉睡 <b x-text="HT.fmt.span(span)"></b>，于 <span x-text="HT.fmt.full(openAt)"></span> 开启</span>
                </template>
                <template x-if="span <= 0">
                  <span>选一个开启的时刻</span>
                </template>
              </div>
              <button class="btn btn--primary btn--lg" :class="submitting ? 'is-busy' : ''" type="submit" :disabled="submitting" data-testid="create-submit">
                {!! UiHelper::icon('lock') !!}
                <span x-text="submitting ? '正在封存…' : '封存胶囊'"></span>
              </button>
            </div>
          </form>

          <aside class="create__side">
            <div class="preview card">
              <div class="preview__head">
                <span class="eyebrow">实时预览</span>
                <span class="badge badge--amber">尚未封存</span>
              </div>
              <div class="preview__art" x-html="HT.capsuleArtSvg(null, 'opened', 220)"></div>
              <h3 class="preview__title" x-text="title.trim() || '未命名的胶囊'"></h3>
              <div class="preview__by">
                <span style="display:contents" x-html="HT.avatarHtml($store.auth.user?.avatarId)"></span>
                <span x-text="$store.auth.user?.nickname || ''"></span>
              </div>
              <dl class="preview__table">
                <div><dt>开启时间</dt><dd class="mono" x-text="HT.fmt.dashDateTime(openAt)"></dd></div>
                <div><dt>沉睡时长</dt><dd x-text="span > 0 ? HT.fmt.span(span) : '—'"></dd></div>
                <div><dt>正文</dt><dd x-text="`${HT.fmt.num(contentLen)} 字`"></dd></div>
              </dl>
              <div class="badges">
                <template x-if="inPlaza">
                  <span class="badge badge--plaza">{!! UiHelper::icon('globe') !!}广场公开</span>
                </template>
                <template x-if="!inPlaza">
                  <span class="badge badge--private">{!! UiHelper::icon('lock') !!}仅凭码可见</span>
                </template>
                <span class="badge badge--amber">{!! UiHelper::icon('clock') !!}<span x-text="`${HT.fmt.span(Math.max(span, 0))}后`"></span></span>
              </div>
            </div>

            <ul class="notes">
              <li>{!! UiHelper::icon('key') !!}<span>封存后会得到一串 8 位胶囊码，它是开启胶囊的凭证，也能分享给别人。</span></li>
              <li>{!! UiHelper::icon('lock') !!}<span>到开启时间之前，内容对所有人不可见——包括写下它的你。</span></li>
              <li>{!! UiHelper::icon('trash') !!}<span>封存后，内容和开启时间都不能再修改；可以在「我创建的」里删除。</span></li>
            </ul>
          </aside>
        </div>
      </div>
    </template>
  </div>
</div>
