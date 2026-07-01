// 广场状态：sort/filter/q + 分页 + 列表缓存（= React stores/plaza.ts）。
// fetch 用自增序列号防并发乱序覆盖。
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import 'providers.dart';

class PlazaState {
  final String sort; // hot | new
  final String filter; // all | opened | unopened
  final String q;
  final int page;
  final int pageSize;
  final List<CapsuleListItem> items;
  final Pagination? pagination;
  final bool loading;
  final String? error;

  const PlazaState({
    this.sort = 'new',
    this.filter = 'all',
    this.q = '',
    this.page = 1,
    this.pageSize = 15,
    this.items = const [],
    this.pagination,
    this.loading = false,
    this.error,
  });

  PlazaState copyWith({
    String? sort,
    String? filter,
    String? q,
    int? page,
    List<CapsuleListItem>? items,
    Pagination? pagination,
    bool? loading,
    String? error,
    bool clearError = false,
  }) =>
      PlazaState(
        sort: sort ?? this.sort,
        filter: filter ?? this.filter,
        q: q ?? this.q,
        page: page ?? this.page,
        pageSize: pageSize,
        items: items ?? this.items,
        pagination: pagination ?? this.pagination,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class PlazaNotifier extends Notifier<PlazaState> {
  int _seq = 0;

  @override
  PlazaState build() => const PlazaState();

  void setSort(String s) {
    state = state.copyWith(sort: s, page: 1);
    fetch();
  }

  void setFilter(String f) {
    state = state.copyWith(filter: f, page: 1);
    fetch();
  }

  void setQ(String q) {
    state = state.copyWith(q: q, page: 1);
    fetch();
  }

  void setPage(int p) {
    state = state.copyWith(page: p);
    fetch();
  }

  Future<void> fetch() async {
    final myId = ++_seq;
    state = state.copyWith(loading: true, clearError: true);
    try {
      final data = await ref.read(apiClientProvider).plaza(
            sort: state.sort,
            filter: state.filter,
            q: state.q.trim().isEmpty ? null : state.q.trim(),
            page: state.page,
            pageSize: state.pageSize,
          );
      if (myId != _seq) return;
      state = state.copyWith(items: data.items, pagination: data.pagination, loading: false);
    } catch (e) {
      if (myId != _seq) return;
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  void patchFavorited(String capsuleId, bool favorited, int count) {
    state = state.copyWith(
      items: [
        for (final it in state.items)
          if (it.id == capsuleId)
            CapsuleListItem(
              id: it.id,
              code: it.code,
              title: it.title,
              creator: it.creator,
              openAt: it.openAt,
              createdAt: it.createdAt,
              inPlaza: it.inPlaza,
              favoriteCount: count,
              isOpened: it.isOpened,
              favoritedByMe: favorited,
              favoritedAt: it.favoritedAt,
              contentPreview: it.contentPreview,
            )
          else
            it,
      ],
    );
  }
}

final plazaProvider = NotifierProvider<PlazaNotifier, PlazaState>(PlazaNotifier.new);
