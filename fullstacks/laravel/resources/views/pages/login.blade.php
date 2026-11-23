@extends('layouts.app')

@section('content')
<div x-data="loginPage()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._login')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._login')
  </template>
</div>
@endsection
