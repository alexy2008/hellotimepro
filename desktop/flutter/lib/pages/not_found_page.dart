// 404（= React NotFoundPage.tsx）。
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';
import '../theme/components.dart';
import '../theme/tokens.dart';
import '../widgets/main_layout.dart';

class NotFoundPage extends StatelessWidget {
  const NotFoundPage({super.key});
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container2(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
      child: Center(
        child: Column(children: [
          const Text('🛰️', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          Text('404 · 这里什么都没有',
              style: TextStyle(color: c.textPrimary, fontSize: AppSize.fs2xl, fontWeight: AppFont.bold)),
          const SizedBox(height: 8),
          Text('页面可能已被封存，或链接有误。', style: TextStyle(color: c.textSecondary, fontSize: AppSize.fsBase)),
          const SizedBox(height: 20),
          HtButton(label: '回广场', variant: HtVariant.primary, onPressed: () => context.go('/')),
        ]),
      ),
    );
  }
}
