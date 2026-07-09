using Microsoft.UI.Xaml;
using HelloTimePro.Stores;

namespace HelloTimePro;

/// <summary>
/// 应用入口。等价于 main() —— 构造单例、拉起主窗口。
/// </summary>
public partial class App : Application
{
    private Window? _window;

    /// 全局单例 store（会话/导航/主题）。视图与外壳共享同一实例。
    public static AppStore Store { get; } = new();

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        Store.Bootstrap();
        _window = new MainWindow();
        _window.Activate();
    }
}
