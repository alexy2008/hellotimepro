@php
  $size = $size ?? '';
  $autoFocus = $autoFocus ?? false;
  $idAttr = $idAttr ?? '';
@endphp
<div
  @if($idAttr) id="{{ $idAttr }}" @endif
  x-data="paperCodeInput({{ $autoFocus ? 'true' : 'false' }})"
  :class="[
    'code',
    '{{ $size ? 'code--' . $size : '' }}',
    opener.state === 'error' ? 'is-error' : '',
    opener.state === 'checking' ? 'is-checking' : '',
    opener.state === 'ok' ? 'is-ok' : '',
    shaking ? 'is-shake' : ''
  ].filter(Boolean).join(' ')"
  role="group"
  aria-label="8 位胶囊码"
>
  @for ($ci = 0; $ci < 8; $ci++)
    @if ($ci === 4)
      <span class="code__dash" aria-hidden="true"></span>
    @endif
    <input
      class="code__cell mono"
      :class="cellAt({{ $ci }}) ? 'is-filled' : ''"
      type="text"
      inputmode="text"
      maxlength="{{ $ci === 0 ? 8 : 1 }}"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      aria-label="第 {{ $ci + 1 }} 位"
      style="--k:{{ $ci }}"
      :value="cellAt({{ $ci }})"
      @if($ci === 0) data-testid="code-input" @endif
      data-code-cell=""
      :data-value="cellAt({{ $ci }})"
      @focus="$event.target.select()"
      @input="onInput({{ $ci }}, $event)"
      @keydown="onKeyDown({{ $ci }}, $event)"
      @paste="onPaste({{ $ci }}, $event)"
    >
  @endfor
</div>
