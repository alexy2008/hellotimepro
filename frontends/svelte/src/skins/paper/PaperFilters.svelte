<script lang="ts">
  // 纯标记，无逻辑
</script>

<!-- 「时笺」的油墨毛边滤镜：印章与邮戳用 filter: url(#f-rough / #f-ink) 引用 -->
<svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="f-rough" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="f-ink" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="11" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.4 0 0 0 2.55" result="m" />
      <feComposite in="d" in2="m" operator="in" />
    </filter>
  </defs>
</svg>
