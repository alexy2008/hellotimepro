using System.ComponentModel;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Microsoft.UI.Text;
using Windows.UI;
using HelloTimePro.Helpers;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class AppHeader : UserControl
{
    private AppStore Store => App.Store;

    // 活动导航色：signal 青（两套主题下都醒目，对齐 .cy-nav__active 的青色文字）。
    private static readonly SolidColorBrush ActiveBrush = new(Color.FromArgb(0xFF, 0x14, 0xD4, 0xF0));

    public AppHeader()
    {
        InitializeComponent();
        Store.PropertyChanged += OnStoreChanged;
        Store.NavigationChanged += Refresh;
        Refresh();
    }

    private void OnStoreChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName is nameof(AppStore.CurrentUser) or nameof(AppStore.IsAuthenticated)
            or nameof(AppStore.Theme))
            Refresh();
    }

    private void Refresh()
    {
        ThemeIcon.Text = Store.Theme == AppTheme.Dark ? "🌙" : "☀️";

        var user = Store.CurrentUser;
        if (user != null)
        {
            GuestPanel.Visibility = Visibility.Collapsed;
            UserChip.Visibility = Visibility.Visible;
            UserName.Text = user.Nickname;
            UserAvatar.Background = Avatars.Brush(user.AvatarId);
        }
        else
        {
            GuestPanel.Visibility = Visibility.Visible;
            UserChip.Visibility = Visibility.Collapsed;
        }

        HighlightNav();
    }

    private void HighlightNav()
    {
        SetActive(NavPlaza, Store.Current.Kind == RouteKind.Plaza);
        SetActive(NavOpen, Store.Current.Kind == RouteKind.Open);
        SetActive(NavAbout, Store.Current.Kind == RouteKind.About);
    }

    private static void SetActive(Button b, bool active)
    {
        if (active) b.Foreground = ActiveBrush;
        else b.ClearValue(Control.ForegroundProperty); // 恢复主题默认色；置 null 会让文字不可见
        b.FontWeight = active ? FontWeights.SemiBold : FontWeights.Normal;
    }

    private void OnBrand(object s, RoutedEventArgs e) => Store.Navigate(Route.Plaza);
    private void OnNavPlaza(object s, RoutedEventArgs e) => Store.Navigate(Route.Plaza);
    private void OnNavOpen(object s, RoutedEventArgs e) => Store.Navigate(Route.Open);
    private void OnNavAbout(object s, RoutedEventArgs e) => Store.Navigate(Route.About);
    private void OnToggleTheme(object s, RoutedEventArgs e) => Store.ToggleTheme();
    private void OnLogin(object s, RoutedEventArgs e) => Store.Navigate(Route.Login);
    private void OnRegister(object s, RoutedEventArgs e) => Store.Navigate(Route.Register);
    private void OnMeCreated(object s, RoutedEventArgs e) => Store.Navigate(Route.MeCreated);
    private void OnMeFavorites(object s, RoutedEventArgs e) => Store.Navigate(Route.MeFavorites);
    private void OnMeProfile(object s, RoutedEventArgs e) => Store.Navigate(Route.MeProfile);
    private async void OnLogout(object s, RoutedEventArgs e) => await Store.LogoutAsync();
}
