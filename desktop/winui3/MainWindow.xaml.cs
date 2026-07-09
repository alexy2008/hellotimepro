using System.ComponentModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using HelloTimePro.Stores;
using HelloTimePro.Views;

namespace HelloTimePro;

public sealed partial class MainWindow : Window
{
    private AppStore Store => App.Store;

    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;

        Store.NavigationChanged += RenderContent;
        Store.PropertyChanged += OnStoreChanged;

        ApplyTheme();
        RenderContent();
    }

    private void OnStoreChanged(object? sender, PropertyChangedEventArgs e)
    {
        switch (e.PropertyName)
        {
            case nameof(AppStore.Theme): ApplyTheme(); break;
            case nameof(AppStore.Banner): ApplyBanner(); break;
        }
    }

    private void ApplyTheme() =>
        RootGrid.RequestedTheme = Store.Theme == AppTheme.Dark ? ElementTheme.Dark : ElementTheme.Light;

    private void ApplyBanner()
    {
        if (string.IsNullOrEmpty(Store.Banner))
        {
            BannerBar.Visibility = Visibility.Collapsed;
        }
        else
        {
            BannerText.Text = Store.Banner;
            BannerBar.Visibility = Visibility.Visible;
        }
    }

    private void OnDismissBanner(object sender, RoutedEventArgs e) => Store.Banner = null;

    // 内容切换：对齐 desktop/swiftui RootView 的 switch store.current → view。
    private void RenderContent()
    {
        ContentHost.Content = Store.Current.Kind switch
        {
            RouteKind.Plaza => new PlazaView(),
            RouteKind.Open => new OpenView(),
            RouteKind.About => new AboutView(),
            RouteKind.Create => new CreateView(),
            RouteKind.Login => new LoginView(),
            RouteKind.Register => new RegisterView(),
            RouteKind.MeCreated or RouteKind.MeFavorites or RouteKind.MeProfile => new MeView(Store.Current.Kind),
            RouteKind.Capsule => new CapsuleDetailView(Store.Current.Code ?? ""),
            _ => new PlaceholderView("未知页面"),
        };
    }
}
