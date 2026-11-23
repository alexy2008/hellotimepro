@extends('layouts.app')

@section('content')
<div x-data="mePage()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._me')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._me')
  </template>
</div>
@endsection
