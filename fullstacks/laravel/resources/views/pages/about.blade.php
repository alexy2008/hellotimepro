@extends('layouts.app')

@section('content')
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._about')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._about')
  </template>
@endsection
