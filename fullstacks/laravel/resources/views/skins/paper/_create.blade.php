@php
  use App\Support\UiHelper;
  $presets = [
    ['key' => '1m', 'label' => '1 分钟后', 'sub' => '体验启封'],
    ['key' => 'tm', 'label' => '明早 9 点', 'sub' => ''],
    ['key' => '1mo', 'label' => '1 个月后', 'sub' => ''],
    ['key' => '1y', 'label' => '1 年后', 'sub' => ''],
    ['key' => '5y', 'label' => '5 年后', 'sub' => ''],
    ['key' => '10y', 'label' => '10 年后', 'sub' => ''],
  ];
  $anchors = ['此刻', '1 小时', '1 天', '1 周', '1 个月', '半年', '1 年', '3 年', '5 年', '10 年'];
  $segs = count($anchors) - 1;
  $segW = 124;
  $dow = ['一', '二', '三', '四', '五', '六', '日'];
@endphp
<div class="page page--create">
  <div class="wrap create">
    <header class="pagehead">
      <div>
        <div class="overline"><i></i>New capsule</div>
        <h1 class="h1">写给未来的信</h1>
      </div>
      <p class="lede">
        这段文字会被封存，直到你设定的时刻，<br>
        才能被任何人——包括你自己——打开。
      </p>
    </header>

    <div class="create__grid">
      {{-- ============ 信笺 ============ --}}
      <section class="sheet" :class="`${aiBusy ? 'is-ai' : ''} ${aiThinking ? 'is-thinking' : ''}`" aria-label="信的内容">
        <div class="sheet__head">
          <span class="sheet__to">致 未来 ——</span>
          <button
            class="aibtn"
            :class="aiBusy ? 'is-busy' : ''"
            type="button"
            data-testid="ai-generate"
            title="让 AI 代写正文并建议启封时间；标题留空时会顺便起个标题"
            @click="aiWrite()"
          >
            {!! UiHelper::icon('sparkle') !!}
            <span x-text="aiBusy ? '代笔中…' : aiDone ? '重新代笔' : 'AI 代笔'"></span>
          </button>
        </div>

        <div class="sheet__title" x-data="shakeOn('shake.title')" :class="shaking ? 'is-shake' : ''">
          <input
            type="text"
            autocomplete="off"
            placeholder="给这封信起个标题"
            aria-label="标题，最多 60 字"
            data-testid="create-title"
            :value="title"
            @input="setTitle($event.target.value, $event.target)"
            x-init="setTimeout(() => HT.fmt.focusIfIdle($el), 420)"
          >
          <span class="sheet__n mono"><b x-text="titleLen"></b>/60</span>
        </div>
        <div class="sheet__err" role="alert" :data-testid="errors.title ? 'field-error' : null" data-field="title" x-text="errors.title"></div>

        <div class="recos" :class="showRecos ? '' : 'is-hidden'" :data-testid="showRecos ? 'ai-reco' : null">
          <div class="recos__in">
            <div class="recos__head">
              <span>{!! UiHelper::icon('sparkle') !!}没有头绪？从一个灵感开始</span>
              <button class="linkbtn" type="button" data-testid="reco-refresh" :disabled="recoBusy || aiBusy" @click="loadRecos()">
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
                  <em x-text="`${HT.fmt.span(r.openInDays * 86400000)}后`"></em>
                </button>
              </template>
            </div>
          </div>
        </div>

        <div class="sheet__body" x-data="shakeOn('shake.content')" :class="shaking ? 'is-shake' : ''">
          <textarea
            rows="9"
            aria-label="正文，最多 5000 字"
            placeholder="在这里写下想传到未来的话。&#10;可以是此刻的天气、正在读的书、一个小小的许诺，&#10;或者只是一句：嘿，你还好吗？"
            data-testid="create-content"
            :value="content"
            @input="setContent($event.target.value, $event.target)"
            x-effect="content; $el.style.height = 'auto'; $el.style.height = Math.max($el.scrollHeight, 34 * 9) + 'px'"
          ></textarea>
          <div class="sheet__think" aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
        <div class="sheet__err" role="alert" :data-testid="errors.content ? 'field-error' : null" data-field="content" x-text="errors.content"></div>

        <div class="sheet__foot">
          <span class="sheet__ainote">
            <template x-if="aiNote">
              <span style="display:contents">{!! UiHelper::icon('sparkle') !!}<span x-text="aiNote"></span></span>
            </template>
          </span>
          <span class="sheet__n mono"><b x-text="HT.fmt.num(contentLen)"></b> / 5000</span>
        </div>

        <div class="sheet__sign">
          <span>——</span>
          <span style="display:contents" x-html="HT.avatarHtml($store.auth.user?.avatarId)"></span>
          <b x-text="$store.auth.user?.nickname || ''"></b>
          <span class="sheet__date" x-text="`${HT.fmt.cn($store.clock.now)} ${HT.fmt.week($store.clock.now)}`"></span>
        </div>
      </section>

      {{-- ============ 封缄台 ============ --}}
      <aside class="desk" aria-label="封缄设置">
        <section class="panel" x-data="paperRuler()">
          <div x-data="shakeOn('shake.openAt')" :class="shaking ? 'is-shake' : ''">
            <h2 class="panel__h"><span class="panel__no">壹</span>启封时刻</h2>

            <div class="presets">
              @foreach($presets as $p)
                <button
                  class="chip"
                  :class="preset === '{{ $p['key'] }}' ? 'is-active' : ''"
                  type="button"
                  data-testid="openat-preset"
                  data-value="{{ $p['key'] }}"
                  :data-selected="preset === '{{ $p['key'] }}' ? 'true' : 'false'"
                  @click="pickPaperPreset('{{ $p['key'] }}')"
                >
                  {{ $p['label'] }}@if($p['sub'])<small>{{ $p['sub'] }}</small>@endif
                </button>
              @endforeach
            </div>

            <div
              class="ruler"
              :class="`${drag ? 'is-drag' : ''} ${glide ? 'is-glide' : ''}`"
              tabindex="0"
              role="slider"
              aria-label="启封距离：左右拖动或用方向键调整"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round(v * 100)"
              :aria-valuetext="`${HT.fmt.span(span)}后，${HT.fmt.full(openAt)}`"
              @pointerdown="onPointerDown($event)"
              @keydown="onKeyDown($event)"
            >
              <div class="ruler__strip" :style="stripTransform">
                @for($i = 0; $i <= $segs; $i++)
                  <i class="rt rt--major" style="left:{{ $i * $segW }}px"><b>{{ $anchors[$i] }}</b></i>
                  @if($i < $segs)
                    @for($k = 1; $k < 8; $k++)
                      <i class="{{ $k === 4 ? 'rt rt--mid' : 'rt' }}" style="left:{{ $i * $segW + ($k * $segW) / 8 }}px"></i>
                    @endfor
                  @endif
                @endfor
              </div>
              <div class="ruler__needle" x-ref="needle"></div>
            </div>

            <div class="when">
              <div class="when__rel serif" x-text="`${HT.fmt.span(span)}后`"></div>
              <div class="when__abs" data-testid="create-openat" :data-value="new Date(openAt).toISOString()" x-text="HT.fmt.full(openAt)"></div>
              <button class="linkbtn when__more" :class="calOpen ? 'is-open' : ''" type="button" :aria-expanded="calOpen ? 'true' : 'false'" @click="calOpen = !calOpen">
                {!! UiHelper::icon('calendar') !!}
                <span>精确到分钟</span>
                {!! UiHelper::icon('chev-down', 'ic--chev') !!}
              </button>
            </div>
            <div class="sheet__err" role="alert" :data-testid="errors.openAt ? 'field-error' : null" data-field="openAt" x-text="errors.openAt"></div>

            <div class="calwrap" :class="calOpen ? 'is-open' : ''">
              <div class="calwrap__in">
                <template x-if="calOpen">
                  <div class="cal">
                    <div class="cal__head">
                      <button class="cal__nav" type="button" aria-label="上一年" :disabled="!calCanPrevYear()" @click="calNav(-12)">«</button>
                      <button class="cal__nav" type="button" aria-label="上个月" :disabled="!calCanPrevMonth()" @click="calNav(-1)">‹</button>
                      <div class="cal__title serif"><b class="latin" x-text="calYear"></b> 年 <b class="latin" x-text="calMonth + 1"></b> 月</div>
                      <button class="cal__nav" type="button" aria-label="下个月" :disabled="!calCanNextMonth()" @click="calNav(1)">›</button>
                      <button class="cal__nav" type="button" aria-label="下一年" :disabled="!calCanNextYear()" @click="calNav(12)">»</button>
                    </div>
                    <div class="cal__dow">
                      @foreach($dow as $w)<span>{{ $w }}</span>@endforeach
                    </div>
                    <div class="cal__grid">
                      <template x-for="cell in calCells()" :key="cell.key">
                        <button
                          type="button"
                          :class="`cal__d${cell.out ? ' is-out' : ''}${cell.today ? ' is-today' : ''}${cell.sel ? ' is-sel' : ''}`"
                          :disabled="cell.dis"
                          :aria-label="cell.label"
                          :aria-current="cell.sel ? 'date' : null"
                          @click="calPickDay(cell.ts)"
                        >
                          <span x-text="cell.day"></span>
                          <template x-if="cell.sel">
                            <svg :class="`cal__ring${freshRing ? ' is-draw' : ''}`" viewBox="0 0 40 40" aria-hidden="true">
                              <path d="M21 4.5c9.5-.6 15.6 6 15.4 14.8-.2 9.4-7 16.2-16.8 16-9-.2-15.3-6.8-15-15.8C4.9 10.4 11.4 4 22.8 5.6"/>
                            </svg>
                          </template>
                        </button>
                      </template>
                    </div>
                    <div class="cal__time">
                      <span class="cal__time-k">{!! UiHelper::icon('clock') !!}时刻</span>
                      <input class="cal__t mono" inputmode="numeric" maxlength="2" aria-label="小时" :value="hourText" @input="hourText = $event.target.value" @blur="commitTime('h', $event.target.value)" @keydown="timeKey('h', $event)">
                      <i>:</i>
                      <input class="cal__t mono" inputmode="numeric" maxlength="2" aria-label="分钟" :value="minText" @input="minText = $event.target.value" @blur="commitTime('m', $event.target.value)" @keydown="timeKey('m', $event)">
                      <span class="cal__tz mono" x-text="tzName()"></span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel__h"><span class="panel__no">贰</span>寄往广场</h2>
          <label class="switch">
            <input type="checkbox" :checked="inPlaza" data-testid="create-in-plaza" @change="setInPlaza($event.target.checked)">
            <span class="switch__track"><i></i></span>
            <span class="switch__text">
              <b x-text="inPlaza ? '发布到胶囊广场' : '只凭胶囊码可见'"></b>
              <small x-text="inPlaza ? '所有人能看到标题与倒计时；正文在启封后公开。' : '不会出现在广场；把 8 位胶囊码交给谁，谁才能找到它。'"></small>
            </span>
          </label>
        </section>

        <section class="panel panel--seal" x-data="paperHoldSeal()">
          <h2 class="panel__h"><span class="panel__no">叁</span>封缄</h2>
          <div class="envf" :class="inPlaza ? '' : 'is-private'" aria-hidden="true">
            <div class="envf__stamp" x-html="HT.avatarStampHtml($store.auth.user?.avatarId, 'stamp--sm', false)"></div>
            <div class="envf__pm" x-html="HT.postmarkSvg(HT.fmt.date(openAt), `${HT.fmt.time(openAt)} 启`, 'pm--envf')"></div>
            <div class="envf__to">
              <small>寄往</small>
              <b x-text="HT.fmt.cn(openAt)"></b>
              <span x-text="`${HT.fmt.span(span)}后的未来`"></span>
            </div>
            <div class="envf__title serif" x-text="title.trim() ? `《${title.trim()}》` : '《未命名的信》'"></div>
            <div class="envf__from mono">
              <span x-text="`自 ${HT.fmt.date($store.clock.now)} · ${$store.auth.user?.nickname || ''}`"></span>
              <span x-text="inPlaza ? '广场公开' : '仅凭码可见'"></span>
            </div>
          </div>

          <div class="hold-row">
            <button
              x-ref="holdBtn"
              :class="`hold${holdState === 'holding' ? ' is-holding' : ''}${holdState === 'done' ? ' is-done' : ''}${shaking ? ' is-shake' : ''}`"
              type="button"
              aria-describedby="holdHint"
              data-testid="create-submit"
              @pointerdown="onPointerDown($event)"
              @pointerup="cancelHold()"
              @pointercancel="cancelHold()"
              @lostpointercapture="cancelHold()"
              @keydown="onKeyDown($event)"
              @keyup="onKeyUp($event)"
              @blur="cancelHold()"
              @contextmenu.prevent
            >
              <svg class="hold__ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle class="hold__track" cx="60" cy="60" r="56"/>
                <circle class="hold__prog" cx="60" cy="60" r="56" pathLength="100"/>
              </svg>
              <span style="display:contents" x-html="HT.waxHtml('封', 'hold__wax')"></span>
              <span class="sr-only">长按封缄</span>
            </button>
            <div class="hold-copy">
              <b id="holdHint" x-text="submitting ? '正在封缄…' : hint"></b>
              <p>封存后，内容和开启时间都不能再修改；<br>可以在「我创建的」里删除。</p>
              <p class="hold-poem serif">复恐匆匆说不尽，行人临发又开封。</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>

  {{-- 封缄仪式 → 取信凭证（Teleport 到 body，避免层级截断） --}}
  <template x-teleport="body">
    <template x-if="created && $store.ui.skin === 'paper'">
      <div
        x-data="paperCeremony()"
        :class="`cer${cerCls}`"
        role="dialog"
        aria-modal="true"
        aria-label="封缄完成"
        data-testid="sealed-receipt"
        :data-code="created.code"
      >
        <div class="cer__bg"></div>
        <div class="cer__in">
          <div class="cer__stage">
            <div :class="`env env--cer${envCls}`">
              <div class="env__back"></div>
              <div class="env__letter"><b x-text="created.title"></b><i></i><i></i><i></i><i></i></div>
              <div class="env__front">
                <svg viewBox="0 0 100 64" preserveAspectRatio="none" aria-hidden="true">
                  <path class="env__pocket" d="M0 0 50 36 100 0V64H0Z"/>
                  <path class="env__shade" d="M1 2.2 50 38 99 2.2"/>
                  <path class="env__seam" d="M0 64 47 33.9M100 64 53 33.9"/>
                  <path class="env__edge" d="M0 0 50 36 100 0"/>
                </svg>
              </div>
              <div class="env__flap">
                <i class="env__flap-f"><svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 50 36 100 0"/></svg></i>
                <i class="env__flap-b"></i>
              </div>
              <div class="env__seal" x-html="HT.waxHtml('封')"></div>
            </div>
          </div>
          <div class="rcpt">
            <div class="rcpt__k"><span>封缄完成</span><i></i><span class="latin">Sealed</span></div>
            <h2 class="rcpt__t serif" x-text="`《${created.title}》`"></h2>
            <p class="rcpt__w">
              将于 <b x-text="HT.fmt.full(HT.fmt.ms(created.openAt))"></b> 启封<br>
              还要等 <span x-text="HT.fmt.span(HT.fmt.ms(created.openAt) - Date.now())"></span>
            </p>
            <div class="rcpt__code mono" :aria-label="`胶囊码 ${created.code}`" data-testid="sealed-code">
              <template x-for="(ch, ci) in Array.from(created.code)" :key="ci">
                <span style="display:contents">
                  <span :style="`--i:${ci}`" x-text="ch"></span>
                  <template x-if="ci === 3"><i></i></template>
                </span>
              </template>
            </div>
            <p class="rcpt__hint" x-text="`这 8 位胶囊码是开启它的凭证。${created.inPlaza ? '它也会出现在胶囊广场上。' : '它不会出现在广场，把码交给谁，谁才能找到它。'}`"></p>
            <div class="rcpt__act">
              <button x-ref="firstCopy" class="btn btn--primary" type="button" data-testid="copy-code" @click="$store.feedback.copyText(created.code, `已复制胶囊码 ${created.code}`)">
                {!! UiHelper::icon('copy') !!}复制胶囊码
              </button>
              <button class="btn btn--ghost" type="button" data-testid="copy-link" @click="$store.feedback.copyText(`${window.location.origin}/capsules/${created.code}`, '已复制链接')">
                {!! UiHelper::icon('link') !!}复制链接
              </button>
            </div>
            <div class="rcpt__more">
              <a :href="`/capsules/${created.code}`" data-testid="receipt-view">查看这枚胶囊{!! UiHelper::icon('arrow') !!}</a>
              <button class="linkbtn" type="button" data-testid="receipt-again" @click="again()">
                {!! UiHelper::icon('pen') !!}再写一枚
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </template>
</div>
