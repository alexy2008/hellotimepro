@props(['pagination', 'base' => '/', 'query' => []])

@php
  $page = (int) $pagination['page'];
  $totalPages = (int) $pagination['totalPages'];
  $total = (int) $pagination['total'];
  $href = function ($p) use ($base, $query) {
      $params = array_merge($query, ['page' => $p]);
      return $base . '?' . http_build_query($params);
  };
@endphp

@if($totalPages > 1)
  <div style="display:flex;justify-content:center;align-items:center;gap:var(--space-3);margin:var(--space-8) 0;flex-wrap:wrap">
    @if($page > 1)
      <a class="cy-btn cy-btn--ghost cy-btn--sm" href="{{ $href($page - 1) }}">上一页</a>
    @else
      <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" disabled>上一页</button>
    @endif

    <span style="color:var(--color-text-muted);font-size:var(--font-size-sm)">第 {{ $page }} / {{ $totalPages }} 页 · 共 {{ $total }} 条</span>

    @if($page < $totalPages)
      <a class="cy-btn cy-btn--ghost cy-btn--sm" href="{{ $href($page + 1) }}">下一页</a>
    @else
      <button type="button" class="cy-btn cy-btn--ghost cy-btn--sm" disabled>下一页</button>
    @endif
  </div>
@endif
