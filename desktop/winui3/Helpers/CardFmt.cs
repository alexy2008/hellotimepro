namespace HelloTimePro.Helpers;

// ============================================================
// 胶囊卡片显示辅助：供 XAML x:Bind 函数绑定用（避免在模板里堆转换器）。
// ============================================================
public static class CardFmt
{
    public static string BadgeText(bool isOpened) => isOpened ? "已开启" : "未开启";

    /// 副行：未开启显示倒计时；已开启显示内容预览（可能为空）。
    public static string SubLine(string openAt, bool isOpened, string? preview) =>
        isOpened ? (preview ?? "") : Format.CountdownText(openAt);

    public static string FavText(bool favoritedByMe, int favoriteCount) =>
        (favoritedByMe ? "♥ " : "♡ ") + favoriteCount;

    /// 关于页技术栈图标下的名称标签："React 19" / "Node.js"（无版本时不追加）。
    public static string NameVersion(string name, string? version) =>
        string.IsNullOrEmpty(version) ? name : $"{name} {version}";
}
