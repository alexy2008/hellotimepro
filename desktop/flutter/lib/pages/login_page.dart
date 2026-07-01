// 登录：邮箱 + 密码 → setTokens → 回跳 from 或 /me/created。= React LoginPage.tsx。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../stores/auth.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/main_layout.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});
  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _err;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final tokens =
          await ref.read(apiClientProvider).login(LoginRequest(email: _email.text.trim(), password: _password.text));
      ref.read(authProvider.notifier).setTokens(tokens);
      if (!mounted) return;
      final from = GoRouterState.of(context).uri.queryParameters['from'];
      context.go(from ?? '/me/created');
    } catch (e) {
      setState(() => _err = e is ApiException ? e.message : '登录失败');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container2(
      maxWidth: 720,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: cardDecoration(context),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('欢迎回来',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: AppSize.fs3xl,
                        fontWeight: AppFont.bold,
                        fontFamilyFallback: AppFont.display)),
                const SizedBox(height: 8),
                Text('你留给未来的信，还在等你开启。', style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
                const SizedBox(height: 24),
                const FieldLabel('邮箱'),
                TextField(controller: _email, decoration: htInputDecoration(context), style: TextStyle(color: c.textPrimary)),
                const SizedBox(height: 16),
                const FieldLabel('密码'),
                TextField(
                    controller: _password,
                    obscureText: true,
                    onSubmitted: (_) => _submit(),
                    decoration: htInputDecoration(context),
                    style: TextStyle(color: c.textPrimary)),
                const SizedBox(height: 6),
                Text('忘记密码？暂不支持找回，请联系管理员重置。',
                    style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                const SizedBox(height: 20),
                HtButton(
                    label: _busy ? '登录中…' : '登录',
                    variant: HtVariant.primary,
                    size: HtSize.lg,
                    fullWidth: true,
                    loading: _busy,
                    onPressed: _busy ? null : _submit),
                const SizedBox(height: 16),
                Center(
                  child: Wrap(children: [
                    Text('还没有账号？', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                    GestureDetector(
                      onTap: () => context.go('/register'),
                      child: Text('立即注册', style: TextStyle(color: c.textLink, fontSize: AppSize.fsSm)),
                    ),
                  ]),
                ),
              ]),
            ),
            if (_err != null) ...[const SizedBox(height: 24), HtAlert(variant: AlertVariant.danger, text: _err!)],
          ]),
        ),
      ),
    );
  }
}
