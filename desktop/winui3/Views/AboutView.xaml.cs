using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class AboutView : UserControl
{
    private AppStore Store => App.Store;

    // 桌面端技术栈（静态，对齐 swiftui 用 swiftui.svg+swift.svg 的做法：runtime 图标 + language 图标）。
    private static readonly List<StackItem> DesktopStack = new()
    {
        new StackItem { Role = "framework", Name = ".NET",  Version = "8",  IconUrl = "/static/icons/dotnet.svg" },
        new StackItem { Role = "language",  Name = "C#",    Version = "12", IconUrl = "/static/icons/csharp.svg" },
    };

    public AboutView()
    {
        InitializeComponent();
        DesktopStackIcons.ItemsSource = DesktopStack;
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var h = await Store.Api.HealthAsync();
            BackendStackIcons.ItemsSource = h.Stack.Items;
            BackendSummary.Text = h.Stack.Summary;
            BackendCard.Visibility = Visibility.Visible;

            var framework = "—";
            foreach (var it in h.Stack.Items)
                if (it.Role == "framework") { framework = it.Name; break; }
            BackendMeta.Text = $"后端：{framework}";
        }
        catch
        {
            BackendError.Text = $"无法读取后端信息（{Store.ApiBaseDescription}）";
            BackendError.Visibility = Visibility.Visible;
            BackendMeta.Text = "后端：—";
        }
    }
}
