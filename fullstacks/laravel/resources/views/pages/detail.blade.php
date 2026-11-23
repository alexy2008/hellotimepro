@extends('layouts.app')

@section('content')
<div x-data="capsuleDetailPage()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._detail')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._detail')
  </template>
</div>
@endsection
