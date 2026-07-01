// 远程 SVG：抓字节 → SvgPicture.memory，带内存缓存与兜底（= SwiftUI RemoteSVGImage / AvatarView）。
// 头像走后端 /static/avatars/<id>.svg；缺失时回退首字母圆牌。
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:http/http.dart' as http;

import '../stores/providers.dart';
import '../theme/app_theme.dart';
import '../theme/tokens.dart';

/// 进程级字节缓存（url → bytes / 失败标记 null）。
final _svgCache = <String, Uint8List?>{};

Future<Uint8List?> _fetchSvg(String url) async {
  if (_svgCache.containsKey(url)) return _svgCache[url];
  try {
    final res = await http.get(Uri.parse(url));
    final bytes = res.statusCode == 200 ? res.bodyBytes : null;
    _svgCache[url] = bytes;
    return bytes;
  } catch (_) {
    _svgCache[url] = null;
    return null;
  }
}

class RemoteSvg extends StatefulWidget {
  final String url;
  final double width;
  final double height;
  final Widget Function(BuildContext)? fallback;
  const RemoteSvg({super.key, required this.url, required this.width, required this.height, this.fallback});

  @override
  State<RemoteSvg> createState() => _RemoteSvgState();
}

class _RemoteSvgState extends State<RemoteSvg> {
  late Future<Uint8List?> _future;

  @override
  void initState() {
    super.initState();
    _future = _fetchSvg(widget.url);
  }

  @override
  void didUpdateWidget(RemoteSvg old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) _future = _fetchSvg(widget.url);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Uint8List?>(
      future: _future,
      builder: (context, snap) {
        final bytes = snap.data;
        if (bytes != null) {
          return SvgPicture.memory(bytes, width: widget.width, height: widget.height);
        }
        if (snap.connectionState == ConnectionState.done || bytes == null && snap.hasError) {
          return widget.fallback?.call(context) ?? SizedBox(width: widget.width, height: widget.height);
        }
        return SizedBox(width: widget.width, height: widget.height);
      },
    );
  }
}

/// 用户头像：远程 SVG 圆形裁剪，缺失回退首字母圆牌。
class AvatarView extends ConsumerWidget {
  final String avatarId;
  final String nickname;
  final double size;
  const AvatarView({super.key, required this.avatarId, required this.nickname, this.size = 36});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiClientProvider);
    final url = api.avatarUrl(avatarId.isEmpty ? 'neo' : avatarId);
    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: RemoteSvg(
          url: url,
          width: size,
          height: size,
          fallback: (_) => _letter(context),
        ),
      ),
    );
  }

  Widget _letter(BuildContext context) {
    final c = context.colors;
    final initial = nickname.trim().isEmpty ? '?' : nickname.trim().characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: c.brandPrimary,
      child: Text(initial, style: TextStyle(color: Colors.white, fontSize: size * 0.45, fontWeight: AppFont.bold)),
    );
  }
}

/// 技术栈/小图标 SVG（缺失则不显示）。
class SvgIcon extends StatelessWidget {
  final String url;
  final double size;
  const SvgIcon({super.key, required this.url, this.size = 16});
  @override
  Widget build(BuildContext context) =>
      RemoteSvg(url: url, width: size, height: size, fallback: (_) => SizedBox(width: size, height: size));
}
