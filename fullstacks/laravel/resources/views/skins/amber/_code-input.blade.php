@php
  $size = $size ?? '';
  $autoFocus = $autoFocus ?? false;
@endphp
<div
  x-data="amberCodeInput({{ $autoFocus ? 'true' : 'false' }})"
  :class="[
    'code',
    '{{ $size ? 'code--' . $size : '' }}',
    focused ? 'is-focused' : '',
    opener.state === 'error' ? 'is-error' : '',
    opener.state === 'checking' ? 'is-checking' : '',
    opener.state === 'ok' ? 'is-ok' : '',
    shaking ? 'is-shake' : ''
  ].filter(Boolean).join(' ')"
>
  <input
    x-ref="nativeInput"
    class="code__native"
    type="text"
    inputmode="text"
    autocomplete="off"
    autocapitalize="characters"
    spellcheck="false"
    maxlength="12"
    aria-label="8 位胶囊码"
    data-testid="code-input"
    :value="opener.value"
    @input="onInput($event)"
    @compositionend="onCompositionEnd($event)"
    @keydown.enter.prevent="opener.go(opener.value)"
    @focus="onFocus($event)"
    @blur="focused = false"
  >
  <div class="code__cells" aria-hidden="true">
    @for ($ci = 0; $ci < 8; $ci++)
      <span
        :class="[
          'code__cell',
          '{{ $ci === 4 ? 'has-gap' : '' }}',
          (opener.value[{{ $ci }}] || '') ? 'is-filled' : '',
          (opener.value[{{ $ci }}] || '') && {{ $ci }} >= popFrom ? 'is-pop' : '',
          {{ $ci }} === Math.min(opener.value.length, 7) ? 'is-active' : ''
        ].filter(Boolean).join(' ')"
        data-code-cell=""
        :data-value="opener.value[{{ $ci }}] || ''"
        x-text="opener.value[{{ $ci }}] || ''"
      ></span>
    @endfor
  </div>
</div>
