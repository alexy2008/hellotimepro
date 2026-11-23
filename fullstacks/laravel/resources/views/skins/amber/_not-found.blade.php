@php
  use App\Support\UiHelper;
@endphp
<div class="page">
  <div class="container">
    <div class="notice card" data-testid="not-found">
      <div class="notice__float" x-html="HT.capsuleArtSvg('NOWHERE0', 'opened', 220)"></div>
      <div class="eyebrow eyebrow--center">404</div>
      <h1 class="page-title">这一页飘走了</h1>
      <p class="page-lead">这个地址没有对应的页面。也许是链接抄错了一位，也许它从未存在过。</p>
      <div class="notice__act">
        <a class="btn btn--primary" href="/">回到广场</a>
        <a class="btn btn--ghost" href="/open">{!! UiHelper::icon('key') !!}凭码开启</a>
      </div>
    </div>
  </div>
</div>
