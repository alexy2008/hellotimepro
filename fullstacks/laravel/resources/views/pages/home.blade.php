@extends('layouts.app')

@section('content')
<div x-data="plazaHome()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._home')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._home')
  </template>
</div>
@endsection
