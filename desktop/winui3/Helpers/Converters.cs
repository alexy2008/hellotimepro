using System;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.UI;

namespace HelloTimePro.Helpers;

// ============================================================
// XAML 值转换器：字符串 hex → SolidColorBrush；avatarId → SVG 图源；bool → 可见性。
// ============================================================

/// "#rrggbb" / "#aarrggbb" → SolidColorBrush。
public sealed class HexToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is string s && TryParseHex(s, out var c)) return new SolidColorBrush(c);
        return new SolidColorBrush(Colors.Transparent);
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) =>
        throw new NotSupportedException();

    public static bool TryParseHex(string s, out Color color)
    {
        color = Colors.Transparent;
        s = s.Trim().TrimStart('#');
        if (s.Length == 3) s = $"{s[0]}{s[0]}{s[1]}{s[1]}{s[2]}{s[2]}";
        byte a = 0xFF, r, g, b;
        try
        {
            if (s.Length == 8)
            {
                a = System.Convert.ToByte(s.Substring(0, 2), 16);
                s = s.Substring(2);
            }
            if (s.Length != 6) return false;
            r = System.Convert.ToByte(s.Substring(0, 2), 16);
            g = System.Convert.ToByte(s.Substring(2, 2), 16);
            b = System.Convert.ToByte(s.Substring(4, 2), 16);
        }
        catch { return false; }
        color = Color.FromArgb(a, r, g, b);
        return true;
    }
}

/// avatarId（string）→ SvgImageSource（后端 /static/avatars/<id>.svg）。
public sealed class AvatarConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language) =>
        Avatars.Source(value as string);

    public object ConvertBack(object value, Type targetType, object parameter, string language) =>
        throw new NotSupportedException();
}

/// 相对资源路径（如 "/static/icons/dotnet.svg"）→ SvgImageSource（关于页技术栈图标）。
public sealed class AssetIconConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value is string path && path.Length > 0 && App.Store.Api.ResolveAsset(path) is { } uri)
            return new SvgImageSource(uri);
        return null!;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language) =>
        throw new NotSupportedException();
}

/// bool → Visibility（true=Visible）。
public sealed class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, string language) =>
        value is true ? Visibility.Visible : Visibility.Collapsed;

    public object ConvertBack(object value, Type targetType, object parameter, string language) =>
        value is Visibility.Visible;
}
