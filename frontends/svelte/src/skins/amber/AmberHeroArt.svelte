<!-- 主视觉：一枚悬浮在「时间表盘」中央的胶囊。三层圆环反向旋转，年份环缓缓流过；鼠标带一点视差。
     渐变 id 是固定的：主视觉整页只有一个 -->
<script lang="ts">
  import { reducedMotion } from "@/lib/fmt";
  import { sparkle } from "./art";

  let el = $state<HTMLElement>();
  const y0 = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => y0 + i).join(" · ") + " · ";
  const SPARKS = [
    [72, 96, 14],
    [522, 90, 9],
    [550, 452, 12],
    [60, 474, 8],
    [404, 226, 6],
  ] as const;

  $effect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        el.style.setProperty("--tilt-x", `${(-dy * 14).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(dx * 16).toFixed(2)}deg`);
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  });
</script>

<div bind:this={el} class="hart" aria-hidden="true">
  <svg class="hart__svg" viewBox="0 0 600 600">
    <defs>
      <radialGradient id="hHalo" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#ffb347" stop-opacity=".4" />
        <stop offset=".55" stop-color="#8f7dff" stop-opacity=".12" />
        <stop offset="1" stop-color="#8f7dff" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="hMetal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff2c2" />
        <stop offset=".22" stop-color="#ffc65c" />
        <stop offset=".6" stop-color="#f6902c" />
        <stop offset=".86" stop-color="#d9641a" />
        <stop offset="1" stop-color="#ffb45a" />
      </linearGradient>
      <linearGradient id="hSeam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#5a4ec2" />
        <stop offset=".3" stop-color="#2c2674" />
        <stop offset="1" stop-color="#120f38" />
      </linearGradient>
      <radialGradient id="hCore" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#fff3c9" stop-opacity=".95" />
        <stop offset=".38" stop-color="#ffb347" stop-opacity=".55" />
        <stop offset="1" stop-color="#ff7a45" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="hArc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe08a" />
        <stop offset="1" stop-color="#ff7b4a" />
      </linearGradient>
      <clipPath id="hGlassClip">
        <path d="M238 300V388A62 62 0 0 0 362 388V300Z" />
      </clipPath>
      <path id="hYearPath" d="M68 300a232 232 0 1 1 464 0a232 232 0 1 1-464 0" />
    </defs>
    <circle class="hart__halo" cx="300" cy="300" r="260" fill="url(#hHalo)" />
    <g class="hart__ring hart__ring--outer">
      <circle class="hart__ticks" cx="300" cy="300" r="278" />
      <circle class="hart__planet hart__planet--amber" cx="300" cy="22" r="5.5" />
      <circle class="hart__planet hart__planet--cyan" cx="496.6" cy="496.6" r="3.6" />
    </g>
    <g class="hart__ring hart__ring--years">
      <text class="hart__years">
        <textPath href="#hYearPath" textLength="1440" lengthAdjust="spacing">{years}</textPath>
      </text>
    </g>
    <g class="hart__ring hart__ring--mid">
      <circle class="hart__line" cx="300" cy="300" r="204" />
      <circle class="hart__major" cx="300" cy="300" r="204" />
      <circle class="hart__planet hart__planet--violet" cx="96" cy="300" r="7" />
    </g>
    <g class="hart__ring hart__ring--inner">
      <circle class="hart__dash" cx="300" cy="300" r="162" />
      <circle class="hart__arc" cx="300" cy="300" r="162" stroke="url(#hArc)" />
    </g>
    <ellipse class="hart__shadow" cx="300" cy="492" rx="96" ry="12" />
    <g class="hart__capsule">
      <g transform="rotate(26 300 300)">
        <path class="hart__glass" d="M238 300V388A62 62 0 0 0 362 388V300Z" />
        <g clip-path="url(#hGlassClip)">
          <circle class="hart__core" cx="300" cy="372" r="84" fill="url(#hCore)" />
          <rect class="hart__scroll" x="270" y="322" width="60" height="94" rx="9" />
          <path class="hart__scroll-line" d="M282 342h36M282 354h36M282 366h22" />
          <rect class="hart__ribbon" x="270" y="382" width="60" height="11" />
          <circle class="hart__wax" cx="300" cy="387.5" r="8.5" />
        </g>
        <path class="hart__reflection" d="M254 316V386A46 46 0 0 0 268 420" />
        <path d="M238 300V212A62 62 0 0 1 362 212V300Z" fill="url(#hMetal)" />
        <path class="hart__groove" d="M238 268h124M238 280h124" />
        <circle class="hart__emblem" cx="300" cy="216" r="24" />
        <path class="hart__hand" d="M300 202v14l9 6" />
        <path class="hart__highlight" d="M256 284V214A44 44 0 0 1 280 176" />
        <rect x="230" y="291" width="140" height="18" rx="9" fill="url(#hSeam)" />
        <path class="hart__seam-light" d="M242 296h116" />
      </g>
    </g>
    {#each SPARKS as [x, y, r], i (i)}
      <path class="hart__spark" style:animation-delay={`${-i * 0.7}s`} d={sparkle(x, y, r)} />
    {/each}
  </svg>
</div>
