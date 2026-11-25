<ul class="ssr-capsules">
  @forelse ($capsules as $entry)
    <li>
      <article>
        <h3><a href="/capsules/{{ $entry['code'] }}">{{ $entry['title'] }}</a></h3>
        <p>{{ $entry['creator']['nickname'] }} · {{ $entry['isOpened'] ? '已开启' : '封存中' }}</p>
        @if ($entry['isOpened'] && $entry['contentPreview'])
          <p>{{ $entry['contentPreview'] }}</p>
        @endif
      </article>
    </li>
  @empty
    <li>暂无胶囊</li>
  @endforelse
</ul>
