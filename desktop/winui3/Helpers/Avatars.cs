using System;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;

namespace HelloTimePro.Helpers;

// ============================================================
// 头像加载：WinUI 的 SvgImageSource 原生支持 SVG（不同于 iOS/RN 需降级），
// 直接从后端 /static/avatars/<id>.svg 拉取渲染。经反向隧道回到 Mac 反代。
// ============================================================
public static class Avatars
{
    public static SvgImageSource Source(string? avatarId)
    {
        var id = string.IsNullOrEmpty(avatarId) ? "neo" : avatarId;
        return new SvgImageSource(App.Store.Api.AvatarUrl(id));
    }

    /// 供 Border/Shape 的 Background/Fill 使用的 ImageBrush（等比填充）。
    public static ImageBrush Brush(string? avatarId) =>
        new() { ImageSource = Source(avatarId), Stretch = Stretch.UniformToFill };
}
