@extends('layouts.app')

@section('content')
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._not-found')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._not-found')
  </template>
@endsection
