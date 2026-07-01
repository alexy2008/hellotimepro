// 注册：邮箱/昵称/密码 + 头像选择 → setTokens → /create。= React RegisterPage.tsx。
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models/models.dart';
import '../stores/auth.dart';
import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/avatar_picker.dart';
import '../widgets/main_layout.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});
  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _email = TextEditingController();
  final _nickname = TextEditingController();
  final _password = TextEditingController();
  List<Avatar> _avatars = [];
  String? _avatarId;
  bool _busy = false;
  String? _err;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAvatars());
  }

  @override
  void dispose() {
    _email.dispose();
    _nickname.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _loadAvatars() async {
    try {
      final list = await ref.read(apiClientProvider).avatars();
      setState(() {
        _avatars = list;
        if (list.isNotEmpty) _avatarId = list.first.id;
      });
    } catch (_) {
      setState(() => _err = '拉取头像列表失败，请检查后端是否已启动');
    }
  }

  Future<void> _submit() async {
    if (_avatarId == null) {
      setState(() => _err = '请选择一个头像');
      return;
    }
    setState(() {
      _busy = true;
      _err = null;
    });
    try {
      final tokens = await ref.read(apiClientProvider).register(RegisterRequest(
            email: _email.text.trim(),
            password: _password.text,
            nickname: _nickname.text.trim(),
            avatarId: _avatarId!,
          ));
      ref.read(authProvider.notifier).setTokens(tokens);
      if (mounted) context.go('/create');
    } catch (e) {
      setState(() => _err = e is ApiException ? e.message : '注册失败');
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
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: cardDecoration(context),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('注册新身份',
                    style: TextStyle(
                        color: c.textPrimary,
                        fontSize: AppSize.fs3xl,
                        fontWeight: AppFont.bold,
                        fontFamilyFallback: AppFont.display)),
                const SizedBox(height: 8),
                Text('选一个赛博头像、写一封最早 60 秒后才能打开的信。',
                    style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
                const SizedBox(height: 24),
                const FieldLabel('邮箱'),
                TextField(controller: _email, decoration: htInputDecoration(context), style: TextStyle(color: c.textPrimary)),
                const SizedBox(height: 16),
                const FieldLabel('昵称'),
                TextField(
                    controller: _nickname,
                    maxLength: 20,
                    decoration: htInputDecoration(context).copyWith(counterText: ''),
                    style: TextStyle(color: c.textPrimary)),
                Text('2–20 字符，注册后可修改。', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                const SizedBox(height: 16),
                const FieldLabel('密码'),
                TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: htInputDecoration(context),
                    style: TextStyle(color: c.textPrimary)),
                Text('至少 8 位，需包含字母和数字。', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                const SizedBox(height: 16),
                const FieldLabel('选择头像（必选）'),
                const SizedBox(height: 8),
                AvatarPicker(avatars: _avatars, value: _avatarId, onChange: (id) => setState(() => _avatarId = id)),
                const SizedBox(height: 8),
                Text('10 个内置头像，不支持上传自定义头像。', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                const SizedBox(height: 20),
                HtButton(
                    label: _busy ? '提交中…' : '创建账号并进入创建胶囊',
                    variant: HtVariant.primary,
                    size: HtSize.lg,
                    fullWidth: true,
                    loading: _busy,
                    onPressed: _busy ? null : _submit),
                const SizedBox(height: 16),
                Center(
                  child: Wrap(children: [
                    Text('已有账号？', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
                    GestureDetector(
                      onTap: () => context.go('/login'),
                      child: Text('去登录', style: TextStyle(color: c.textLink, fontSize: AppSize.fsSm)),
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
