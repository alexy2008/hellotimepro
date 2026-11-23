@php
  use App\Support\UiHelper;
@endphp
<div class="page">
  <div class="wrap wrap--narrow detail">
    <div class="lost" data-testid="not-found">
      <div class="lost__mark">
        <span class="seal seal--line" aria-hidden="true">迷</span>
      </div>
      <h1 class="h1">查无此页</h1>
      <p>
        这个地址没有对应的页面。
        <br>
        也许是链接抄错了一位，也许它从未存在过。
      </p>
      <div class="lost__act">
        <a class="btn btn--primary" href="/">回到广场</a>
        <a class="btn btn--ghost" href="/open">{!! UiHelper::icon('key') !!}凭码开启</a>
      </div>
    </div>
  </div>
</div>
