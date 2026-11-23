@php
  use App\Support\UiHelper;
  $dow = ['一', '二', '三', '四', '五', '六', '日'];
  $f2 = fn ($n) => number_format($n, 2, '.', '');
@endphp
<div
  class="dtp"
  :class="open ? 'is-open' : ''"
  x-data="amberDateTimePicker()"
  @keydown.escape="if (open) { $event.stopPropagation(); closeAndFocus(); }"
>
  <button
    x-ref="trigger"
    class="dtp__trigger"
    type="button"
    id="openAt"
    aria-haspopup="dialog"
    :aria-expanded="open ? 'true' : 'false'"
    aria-controls="dtpPanel"
    aria-describedby="dtpVal"
    data-testid="create-openat"
    :data-value="new Date(openAt).toISOString()"
    @click="setOpen(!open)"
  >
    {!! UiHelper::icon('calendar', 'ic--cal') !!}
    <span class="dtp__val" id="dtpVal">
      <span class="dtp__date" x-text="triggerDate()"></span>
      <span class="dtp__wd" x-text="triggerWd()"></span>
      <span class="dtp__time" x-text="triggerTime()"></span>
    </span>
    <span class="dtp__rel" x-text="triggerRel()"></span>
    {!! UiHelper::icon('chev-down', 'ic--chev') !!}
  </button>

  <div class="dtp__panel" id="dtpPanel" x-ref="panel" role="dialog" aria-label="选择开启时间">
    <div class="dtp__clip">
      <div class="dtp__in" x-ref="panelInner">
        {{-- 十年星轨 --}}
        <div class="orbit">
          <div class="dtp__k">
            十年星轨<b x-text="`${(orbitF() * 10).toFixed(1)} / 10 年`"></b>
          </div>
          <div
            x-ref="rail"
            class="orbit__rail"
            :class="draggingRail ? 'is-drag' : ''"
            @pointerdown="onRailDown($event)"
            @pointermove="onRailMove($event)"
            @pointerup="endRail()"
            @pointercancel="endRail()"
          >
            <div class="orbit__line"></div>
            <div class="orbit__trail" :style="`width:${(orbitF() * 100).toFixed(2)}%`"></div>
            <div>
              <template x-for="node in orbitNodes()" :key="node.i">
                <button
                  type="button"
                  :class="`orbit__node${node.past ? ' is-past' : ''}${node.cur ? ' is-cur' : ''}`"
                  :style="`left:${node.i * 10}%`"
                  :aria-label="`穿越到 ${node.year} 年`"
                  @click="jumpYear(node.i)"
                >
                  <i></i>
                  <span x-text="node.label"></span>
                </button>
              </template>
            </div>
            <div
              class="orbit__cap"
              :style="`left:${(orbitF() * 100).toFixed(2)}%`"
              tabindex="0"
              role="slider"
              aria-label="沿十年星轨拖动胶囊（方向键按月，PageUp / PageDown 按年）"
              :aria-valuetext="`${new Date(openAt).getFullYear()} 年 ${new Date(openAt).getMonth() + 1} 月`"
              @keydown="onCapKey($event)"
            >
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path class="orbit__cap-top" d="M9 16V11a7 7 0 0 1 14 0v5Z"/>
                <path class="orbit__cap-bot" d="M9 16v5a7 7 0 0 0 14 0v-5Z"/>
                <rect class="orbit__cap-seam" x="8" y="15" width="16" height="2.2" rx="1.1"/>
              </svg>
            </div>
          </div>
        </div>

        {{-- 日历 + 昼夜机械表盘 --}}
        <div class="dtp__body">
          <div class="mcal">
            <div class="mcal__head">
              <div class="mcal__title">
                <span x-text="mcalTitle()"></span>
                <small x-text="mcalSub()"></small>
              </div>
              <button class="mcal__nav" type="button" aria-label="上个月" :disabled="!canPrevMonth()" @click="shiftMonth(-1)">
                {!! UiHelper::icon('chev-left') !!}
              </button>
              <button class="mcal__nav" type="button" aria-label="下个月" :disabled="!canNextMonth()" @click="shiftMonth(1)">
                {!! UiHelper::icon('chev-right') !!}
              </button>
            </div>
            <div class="mcal__dow">
              @foreach($dow as $w)<span>{{ $w }}</span>@endforeach
            </div>
            <div x-ref="grid" class="mcal__grid" role="grid" aria-label="日期" @keydown="onGridKey($event)">
              <template x-for="cell in mcalCells()" :key="cell.key">
                <button
                  type="button"
                  role="gridcell"
                  :class="cell.cls"
                  :disabled="cell.dis"
                  :tabindex="cell.sel ? 0 : -1"
                  :aria-selected="cell.sel ? 'true' : 'false'"
                  :aria-label="cell.label"
                  @click="pickMcalDay(cell)"
                  x-text="cell.day"
                ></button>
              </template>
            </div>
          </div>

          <div class="clock" :class="isDay() ? 'is-day' : 'is-night'" :data-mode="mode">
            <div class="clock__read">
              <div class="clock__seg">
                <button type="button" :class="mode === 'h' ? 'is-on' : ''" aria-label="调小时" @click="mode = 'h'" x-text="HT.fmt.pad2(hourVal())"></button>
                <i>:</i>
                <button type="button" :class="mode === 'm' ? 'is-on' : ''" aria-label="调分钟" @click="mode = 'm'" x-text="HT.fmt.pad2(minVal())"></button>
              </div>
              <div class="ampm">
                <button type="button" :class="hourVal() < 12 ? 'is-on' : ''" @click="setAmPm('am')">{!! UiHelper::icon('sun') !!}上午</button>
                <button type="button" :class="hourVal() >= 12 ? 'is-on' : ''" @click="setAmPm('pm')">{!! UiHelper::icon('moon') !!}下午</button>
              </div>
            </div>
            <div class="clock__case">
              <i class="clock__crown" aria-hidden="true"></i>
              <svg
                x-ref="dial"
                class="clock__dial"
                :class="draggingDial ? 'is-drag' : ''"
                viewBox="-12 -12 244 244"
                tabindex="0"
                role="slider"
                aria-label="表盘：拖动指针调整时刻"
                :aria-valuetext="`${hourVal()} 点 ${minVal()} 分`"
                @pointerdown="onDialDown($event)"
                @pointermove="onDialMove($event)"
                @pointerup="endDial()"
                @pointercancel="endDial()"
                @keydown="onDialKey($event)"
              >
                <defs>
                  {{-- amber-dtp-hand 等 id 由 spec/styles/amber/components.css 引用，严格保持原名 --}}
                  <linearGradient id="amber-dtp-hand" gradientUnits="userSpaceOnUse" x1="110" y1="118" x2="110" y2="58">
                    <stop class="clock__g-hand-a" offset="0"/>
                    <stop class="clock__g-hand-b" offset="1"/>
                  </linearGradient>
                  <radialGradient id="amber-dtp-day" cx=".5" cy=".78" r=".75">
                    <stop class="clock__g-day" offset="0" stop-opacity=".35"/>
                    <stop class="clock__g-day" offset="1" stop-opacity="0"/>
                  </radialGradient>
                  <radialGradient id="amber-dtp-night" cx=".5" cy=".3" r=".8">
                    <stop class="clock__g-night" offset="0" stop-opacity=".32"/>
                    <stop class="clock__g-night" offset="1" stop-opacity="0"/>
                  </radialGradient>
                  <radialGradient id="amber-dtp-edge" cx=".5" cy=".5" r=".5">
                    <stop class="clock__g-edge" offset=".82" stop-opacity="0"/>
                    <stop class="clock__g-edge" offset="1" stop-opacity=".22"/>
                  </radialGradient>
                  <clipPath id="amber-dtp-face"><circle cx="110" cy="110" r="110"/></clipPath>
                </defs>
                <circle class="clock__face" cx="110" cy="110" r="110"/>
                <g clip-path="url(#amber-dtp-face)">
                  <g class="clock__sky clock__sky--day">
                    <rect width="220" height="220" fill="url(#amber-dtp-day)"/>
                    <circle class="clock__sun" cx="110" cy="160" r="13"/>
                    <circle class="clock__sun clock__sun--halo" cx="110" cy="160" r="22"/>
                  </g>
                  <g class="clock__sky clock__sky--night">
                    <rect width="220" height="220" fill="url(#amber-dtp-night)"/>
                    <path class="clock__moon" d="M118 150a12 12 0 1 1-12.5-14 9.5 9.5 0 0 0 12.5 14Z"/>
                    <g class="clock__stars">
                      <circle cx="72" cy="68" r="1.2" opacity=".8"/>
                      <circle cx="150" cy="62" r="1" opacity=".6"/>
                      <circle cx="160" cy="140" r="1.4" opacity=".7"/>
                      <circle cx="58" cy="132" r="1" opacity=".5"/>
                      <circle cx="132" cy="172" r=".9" opacity=".6"/>
                      <circle cx="84" cy="172" r="1.1" opacity=".5"/>
                    </g>
                  </g>
                </g>
                <circle class="clock__vignette" cx="110" cy="110" r="110" fill="url(#amber-dtp-edge)"/>
                <circle class="clock__rehaut" cx="110" cy="110" r="102"/>
                <g>
                  @for($i = 0; $i < 60; $i++)
                    @php
                      $a = ($i * 6 * M_PI) / 180;
                      $five = ($i % 5 === 0);
                      $r1 = $five ? 92 : 96;
                    @endphp
                    <line class="clock__tick{{ $five ? ' is-5' : '' }}" x1="{{ $f2(110 + $r1 * sin($a)) }}" y1="{{ $f2(110 - $r1 * cos($a)) }}" x2="{{ $f2(110 + 100 * sin($a)) }}" y2="{{ $f2(110 - 100 * cos($a)) }}"/>
                  @endfor
                </g>
                <g>
                  @for($h = 1; $h <= 12; $h++)
                    @if($h !== 3)
                      @php $a = ($h * 30 * M_PI) / 180; @endphp
                      <text class="clock__num{{ $h % 3 === 0 ? ' is-q' : '' }}" x="{{ $f2(110 + 78 * sin($a)) }}" y="{{ $f2(110 - 78 * cos($a)) }}">{{ $h }}</text>
                    @endif
                  @endfor
                </g>
                <g>
                  @for($i = 0; $i < 60; $i++)
                    @php $rot = 'rotate(' . ($i * 6) . ' 110 110)'; @endphp
                    @if($i === 0)
                      <path class="clock__lume" d="M106 -9h8L110 -3Z"/>
                    @elseif($i % 10 === 0)
                      <text class="clock__bz clock__bz-n" x="110" y="-5.5" transform="{{ $rot }}">{{ $i }}</text>
                    @elseif($i % 5 === 0)
                      <rect class="clock__bz" x="109.3" y="-8.5" width="1.4" height="6" rx=".5" transform="{{ $rot }}"/>
                    @elseif($i < 15)
                      <rect class="clock__bz" x="109.6" y="-7.5" width=".8" height="3.5" transform="{{ $rot }}"/>
                    @else
                      <circle class="clock__bz" cx="110" cy="-5.5" r=".7" transform="{{ $rot }}"/>
                    @endif
                  @endfor
                </g>
                <text class="clock__brand" x="110" y="64">HELLOTIME</text>
                <text class="clock__brand clock__brand--sub" x="110" y="74">Automatic · Sealed</text>
                <g class="clock__date">
                  <rect x="163" y="101" width="24" height="18" rx="3"/>
                  <text x="175" y="110.5" x-text="dayVal()"></text>
                </g>
                <g class="clock__hand clock__hand--h" :style="`transform:rotate(${rotH}deg)`">
                  <line x1="110" y1="118" x2="110" y2="58"/>
                </g>
                <g class="clock__hand clock__hand--m" :style="`transform:rotate(${rotM}deg)`">
                  <line x1="110" y1="124" x2="110" y2="44"/>
                  <circle class="knob" cx="110" cy="44" r="4.5"/>
                </g>
                <circle class="clock__pin" cx="110" cy="110" r="6"/>
                <path class="clock__glass" d="M30 92C40 52 74 26 116 22c-36 14-62 40-74 78-4 2-9 0-12-8Z"/>
              </svg>
            </div>
            <div class="clock__hint" x-text="mode === 'h' ? '拖动时针，松手后自动切到分针' : '拖动分针，越过 12 点会自动进退一小时'"></div>
          </div>
        </div>

        {{-- 精确倒计时与确认按钮 --}}
        <div class="dtp__foot">
          <div class="dtp__eta">
            胶囊将在
            <template x-for="(p, pi) in etaParts()" :key="p.u">
              <span><span x-text="pi ? ' ' : ''"></span><b x-text="p.n"></b><span x-text="p.u"></span></span>
            </template>
            后开启
            <template x-if="clamped">
              <small class="is-warn" x-text="`已贴着可选范围调整（最早 1 分钟后，最晚 10 年内）· ${tzName()}`"></small>
            </template>
            <template x-if="!clamped">
              <small x-text="`按你所在的时区 ${tzName()} 计时`"></small>
            </template>
          </div>
          <button class="btn btn--primary btn--sm" type="button" @click="closeAndFocus()">就这一刻</button>
        </div>
      </div>
    </div>
  </div>
</div>
