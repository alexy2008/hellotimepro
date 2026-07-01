// 我创建的 + 我收藏的：分页 / 删除 / 收藏切换（= React stores/capsule.ts）。
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'plaza.dart';
import 'providers.dart';

const _pageSize = 15;

class ListSlice {
  final List<CapsuleListItem> items;
  final Pagination? pagination;
  final int page;
  final bool loading;
  final String? error;
  const ListSlice({
    this.items = const [],
    this.pagination,
    this.page = 1,
    this.loading = false,
    this.error,
  });

  ListSlice copyWith({
    List<CapsuleListItem>? items,
    Pagination? pagination,
    int? page,
    bool? loading,
    String? error,
    bool clearError = false,
  }) =>
      ListSlice(
        items: items ?? this.items,
        pagination: pagination ?? this.pagination,
        page: page ?? this.page,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class CapsuleListState {
  final ListSlice mine;
  final ListSlice favorites;
  const CapsuleListState({this.mine = const ListSlice(), this.favorites = const ListSlice()});
  CapsuleListState copyWith({ListSlice? mine, ListSlice? favorites}) =>
      CapsuleListState(mine: mine ?? this.mine, favorites: favorites ?? this.favorites);
}

class CapsuleNotifier extends Notifier<CapsuleListState> {
  int _mineSeq = 0;
  int _favSeq = 0;

  @override
  CapsuleListState build() => const CapsuleListState();

  Future<void> fetchMine([int? page]) async {
    final p = page ?? state.mine.page;
    final myId = ++_mineSeq;
    state = state.copyWith(mine: state.mine.copyWith(page: p, loading: true, clearError: true));
    try {
      final data = await ref.read(apiClientProvider).myCapsules(page: p, pageSize: _pageSize);
      if (myId != _mineSeq) return;
      state = state.copyWith(mine: state.mine.copyWith(items: data.items, pagination: data.pagination, loading: false));
    } catch (e) {
      if (myId != _mineSeq) return;
      state = state.copyWith(mine: state.mine.copyWith(loading: false, error: e.toString()));
    }
  }

  Future<void> fetchFavorites([int? page]) async {
    final p = page ?? state.favorites.page;
    final myId = ++_favSeq;
    state = state.copyWith(favorites: state.favorites.copyWith(page: p, loading: true, clearError: true));
    try {
      final data = await ref.read(apiClientProvider).myFavorites(page: p, pageSize: _pageSize);
      if (myId != _favSeq) return;
      state = state.copyWith(
          favorites: state.favorites.copyWith(items: data.items, pagination: data.pagination, loading: false));
    } catch (e) {
      if (myId != _favSeq) return;
      state = state.copyWith(favorites: state.favorites.copyWith(loading: false, error: e.toString()));
    }
  }

  Future<void> deleteCapsule(String id) async {
    await ref.read(apiClientProvider).deleteMyCapsule(id);
    state = state.copyWith(mine: state.mine.copyWith(items: state.mine.items.where((c) => c.id != id).toList()));
  }

  /// 切换收藏，返回最新收藏数；同步广场列表的收藏态。
  Future<int> toggleFavorite(String capsuleId, bool favoritedByMe) async {
    final api = ref.read(apiClientProvider);
    final plaza = ref.read(plazaProvider.notifier);
    if (favoritedByMe) {
      await api.unfavorite(capsuleId);
      state = state.copyWith(
          favorites: state.favorites.copyWith(items: state.favorites.items.where((c) => c.id != capsuleId).toList()));
      final matches = ref.read(plazaProvider).items.where((i) => i.id == capsuleId);
      final cur = matches.isEmpty ? null : matches.first;
      final newCount = ((cur?.favoriteCount ?? 1) - 1).clamp(0, 1 << 30);
      plaza.patchFavorited(capsuleId, false, newCount);
      return newCount;
    } else {
      final result = await api.favorite(capsuleId);
      plaza.patchFavorited(capsuleId, true, result.favoriteCount);
      return result.favoriteCount;
    }
  }

  void reset() {
    _mineSeq++;
    _favSeq++;
    state = const CapsuleListState();
  }
}

final capsuleProvider = NotifierProvider<CapsuleNotifier, CapsuleListState>(CapsuleNotifier.new);
