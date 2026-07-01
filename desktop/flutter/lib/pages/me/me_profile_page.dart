// 账号设置：基本信息（昵称/头像）+ 修改密码（改后 3 秒登出）。= React MeProfilePage.tsx。
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/models.dart';
import '../../stores/auth.dart';
import '../../stores/providers.dart';
import '../../theme/app_theme.dart';
import '../../theme/components.dart';
import '../../theme/tokens.dart';
import '../../widgets/avatar_picker.dart';

class MeProfilePage extends ConsumerStatefulWidget {
  const MeProfilePage({super.key});
  @override
  ConsumerState<MeProfilePage> createState() => _MeProfilePageState();
}

class _MeProfilePageState extends ConsumerState<MeProfilePage> {
  List<Avatar> _avatars = [];
  final _nickname = TextEditingController();
  String? _avatarId;
  bool _profileBusy = false;
  ({AlertVariant v, String text})? _profileMsg;

  final _oldPwd = TextEditingController();
  final _newPwd = TextEditingController();
  final _confirmPwd = TextEditingController();
  bool _pwdBusy = false;
  ({AlertVariant v, String text})? _pwdMsg;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _nickname.text = user?.nickname ?? '';
    _avatarId = user?.avatarId;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final list = await ref.read(apiClientProvider).avatars();
        if (mounted) setState(() => _avatars = list);
      } catch (_) {/* 静默 */}
    });
  }

  @override
  void dispose() {
    _nickname.dispose();
    _oldPwd.dispose();
    _newPwd.dispose();
    _confirmPwd.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;
    setState(() {
      _profileMsg = null;
      _profileBusy = true;
    });
    try {
      final patch = UpdateProfileRequest(
        nickname: _nickname.text != user.nickname ? _nickname.text.trim() : null,
        avatarId: (_avatarId != null && _avatarId != user.avatarId) ? _avatarId : null,
      );
      if (patch.nickname == null && patch.avatarId == null) {
        setState(() => _profileMsg = (v: AlertVariant.info, text: '没有改动'));
        return;
      }
      await ref.read(apiClientProvider).updateProfile(patch);
      await ref.read(authProvider.notifier).refreshMe();
      setState(() => _profileMsg = (v: AlertVariant.success, text: '已保存'));
    } catch (e) {
      setState(() => _profileMsg = (v: AlertVariant.danger, text: e is ApiException ? e.message : '保存失败'));
    } finally {
      if (mounted) setState(() => _profileBusy = false);
    }
  }

  Future<void> _changePassword() async {
    setState(() => _pwdMsg = null);
    if (_newPwd.text != _confirmPwd.text) {
      setState(() => _pwdMsg = (v: AlertVariant.danger, text: '两次输入的新密码不一致'));
      return;
    }
    setState(() => _pwdBusy = true);
    try {
      await ref
          .read(apiClientProvider)
          .changePassword(ChangePasswordRequest(currentPassword: _oldPwd.text, newPassword: _newPwd.text));
      setState(() {
        _pwdMsg = (v: AlertVariant.success, text: '密码已更新，3 秒后将自动登出。');
        _oldPwd.clear();
        _newPwd.clear();
        _confirmPwd.clear();
      });
      Timer(const Duration(seconds: 3), () async {
        await ref.read(authProvider.notifier).logout(callServer: false);
        if (mounted) context.go('/login');
      });
    } catch (e) {
      setState(() => _pwdMsg = (v: AlertVariant.danger, text: e is ApiException ? e.message : '修改失败'));
    } finally {
      if (mounted) setState(() => _pwdBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(authProvider).user;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('账号设置',
          style: TextStyle(
              color: c.textPrimary, fontSize: AppSize.fs2xl, fontWeight: AppFont.bold, fontFamilyFallback: AppFont.display)),
      const SizedBox(height: 16),
      // 基本信息
      Container(
        padding: const EdgeInsets.all(24),
        decoration: cardDecoration(context),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('基本信息',
              style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsXl, fontWeight: AppFont.semibold)),
          const SizedBox(height: 20),
          const FieldLabel('邮箱'),
          TextField(
              enabled: false,
              controller: TextEditingController(text: user?.email ?? ''),
              decoration: htInputDecoration(context),
              style: TextStyle(color: c.textDisabled)),
          Text('邮箱作为登录账号不可修改。', style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
          const SizedBox(height: 16),
          const FieldLabel('昵称'),
          TextField(
              controller: _nickname,
              maxLength: 20,
              decoration: htInputDecoration(context).copyWith(counterText: ''),
              style: TextStyle(color: c.textPrimary)),
          const SizedBox(height: 16),
          const FieldLabel('头像'),
          const SizedBox(height: 8),
          AvatarPicker(avatars: _avatars, value: _avatarId, onChange: (id) => setState(() => _avatarId = id)),
          if (_profileMsg != null) ...[const SizedBox(height: 16), HtAlert(variant: _profileMsg!.v, text: _profileMsg!.text)],
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            HtButton(
                label: '重置',
                variant: HtVariant.ghost,
                onPressed: () => setState(() {
                      _nickname.text = user?.nickname ?? '';
                      _avatarId = user?.avatarId;
                    })),
            const SizedBox(width: 8),
            HtButton(
                label: _profileBusy ? '保存中…' : '保存更改',
                variant: HtVariant.primary,
                loading: _profileBusy,
                onPressed: _profileBusy ? null : _saveProfile),
          ]),
        ]),
      ),
      const SizedBox(height: 24),
      // 修改密码
      Container(
        padding: const EdgeInsets.all(24),
        decoration: cardDecoration(context),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('修改密码', style: TextStyle(color: c.textPrimary, fontSize: AppSize.fsXl, fontWeight: AppFont.semibold)),
          const SizedBox(height: 20),
          const FieldLabel('当前密码'),
          TextField(controller: _oldPwd, obscureText: true, decoration: htInputDecoration(context), style: TextStyle(color: c.textPrimary)),
          const SizedBox(height: 16),
          const FieldLabel('新密码'),
          TextField(controller: _newPwd, obscureText: true, decoration: htInputDecoration(context), style: TextStyle(color: c.textPrimary)),
          Text('至少 8 位且需含字母和数字；保存后所有 refresh token 会被吊销。',
              style: TextStyle(color: c.textMuted, fontSize: AppSize.fsSm)),
          const SizedBox(height: 16),
          const FieldLabel('确认新密码'),
          TextField(
              controller: _confirmPwd, obscureText: true, decoration: htInputDecoration(context), style: TextStyle(color: c.textPrimary)),
          if (_pwdMsg != null) ...[const SizedBox(height: 16), HtAlert(variant: _pwdMsg!.v, text: _pwdMsg!.text)],
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: HtButton(
                label: _pwdBusy ? '更新中…' : '更新密码',
                variant: HtVariant.primary,
                loading: _pwdBusy,
                onPressed: _pwdBusy ? null : _changePassword),
          ),
        ]),
      ),
    ]);
  }
}
