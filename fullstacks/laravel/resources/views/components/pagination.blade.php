@props(['pagination', 'base' => '/', 'query' => []])

@php
  $page = $pagination['page'];
  $totalPages = $pagination['totalPages'];
@endphp

@if($totalPages > 1)
  <div class="cy-pagination">
    @for($p = 1; $p <= $totalPages; $p++)
      @php $params = array_merge($query, ['page' => $p]); @endphp
      <a class="cy-page {{ $p === $page ? 'is-active' : '' }}" href="{{ $base }}?{{ http_build_query($params) }}">{{ $p }}</a>
    @endfor
  </div>
@endif
