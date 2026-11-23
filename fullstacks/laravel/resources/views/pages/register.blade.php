@extends('layouts.app')

@section('content')
<div x-data="registerPage()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._register')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._register')
  </template>
</div>
@endsection
