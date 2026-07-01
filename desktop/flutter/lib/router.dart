// go_router：MainLayout / MeLayout 两套外壳 + AuthGate 重定向 + /c/:code 深链。
// = React router.tsx + AuthGate.tsx。
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'stores/auth.dart';
import 'widgets/main_layout.dart';
import 'widgets/me_layout.dart';
import 'pages/plaza_page.dart';
import 'pages/open_page.dart';
import 'pages/about_page.dart';
import 'pages/login_page.dart';
import 'pages/register_page.dart';
import 'pages/create_page.dart';
import 'pages/capsule_by_code_page.dart';
import 'pages/not_found_page.dart';
import 'pages/me/me_created_page.dart';
import 'pages/me/me_favorites_page.dart';
import 'pages/me/me_profile_page.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // auth 变化时触发 router 重算 redirect
  final refresh = ValueNotifier(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  Page<void> noTransition(Widget child) => NoTransitionPage(child: child);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      if (!auth.hydrated) return null;
      final loc = state.matchedLocation;
      final needsAuth = loc == '/create' || loc.startsWith('/me');
      final allowed = auth.isAuthenticated || auth.refreshToken != null;
      if (needsAuth && !allowed) {
        return '/login?from=${Uri.encodeComponent(loc)}';
      }
      return null;
    },
    routes: [
      ShellRoute(
        builder: (context, state, child) => MainLayout(child: child),
        routes: [
          GoRoute(path: '/', pageBuilder: (c, s) => noTransition(const PlazaPage())),
          GoRoute(path: '/open', pageBuilder: (c, s) => noTransition(const OpenPage())),
          GoRoute(path: '/about', pageBuilder: (c, s) => noTransition(const AboutPage())),
          GoRoute(path: '/login', pageBuilder: (c, s) => noTransition(const LoginPage())),
          GoRoute(path: '/register', pageBuilder: (c, s) => noTransition(const RegisterPage())),
          GoRoute(path: '/create', pageBuilder: (c, s) => noTransition(const CreatePage())),
          GoRoute(
            path: '/c/:code',
            pageBuilder: (c, s) => noTransition(CapsuleByCodePage(code: s.pathParameters['code'] ?? '')),
          ),
        ],
      ),
      GoRoute(path: '/me', redirect: (_, _) => '/me/created'),
      ShellRoute(
        builder: (context, state, child) => MeLayout(child: child),
        routes: [
          GoRoute(path: '/me/created', pageBuilder: (c, s) => noTransition(const MeCreatedPage())),
          GoRoute(path: '/me/favorites', pageBuilder: (c, s) => noTransition(const MeFavoritesPage())),
          GoRoute(path: '/me/profile', pageBuilder: (c, s) => noTransition(const MeProfilePage())),
        ],
      ),
    ],
    errorBuilder: (context, state) => const MainLayout(child: NotFoundPage()),
  );
});
