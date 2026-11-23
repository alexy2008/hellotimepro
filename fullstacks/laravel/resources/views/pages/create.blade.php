@extends('layouts.app')

@section('content')
<div x-data="createPage()">
  <template x-if="$store.ui.skin === 'paper'">
    @include('skins.paper._create')
  </template>
  <template x-if="$store.ui.skin === 'amber'">
    @include('skins.amber._create')
  </template>
</div>
@endsection
