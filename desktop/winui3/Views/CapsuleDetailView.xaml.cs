using System;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.ApplicationModel.DataTransfer;
using Windows.UI;
using HelloTimePro.Api;
using HelloTimePro.Helpers;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class CapsuleDetailView : UserControl
{
    private AppStore Store => App.Store;
    private readonly string _code;
    private CapsuleDetail? _cap;
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(1) };

    private static readonly SolidColorBrush SealedBrush = new(Color.FromArgb(0x33, 0x14, 0xD4, 0xF0));
    private static readonly SolidColorBrush OpenedBrush = new(Color.FromArgb(0x33, 0x1A, 0xA8, 0x66));

    public CapsuleDetailView(string code)
    {
        InitializeComponent();
        _code = code;
        _timer.Tick += (_, _) => Tick();
        Loaded += async (_, _) => await LoadAsync();
        Unloaded += (_, _) => _timer.Stop();
    }

    private async System.Threading.Tasks.Task LoadAsync(bool showLoading = true)
    {
        if (showLoading) SetStatus("加载中…", false);
        try
        {
            _cap = await Store.Api.CapsuleByCodeAsync(_code);
            Render();
        }
        catch (ApiException ex)
        {
            SetStatus(ex.Message, true);
        }
        catch (Exception)
        {
            SetStatus("胶囊不存在", true);
        }
    }

    private void Render()
    {
        if (_cap is not { } c) return;
        StatusPanel.Visibility = Visibility.Collapsed;
        DetailPanel.Visibility = Visibility.Visible;

        StateBadgeText.Text = c.IsOpened ? "已开启" : "未开启";
        StateBadge.Background = c.IsOpened ? OpenedBrush : SealedBrush;
        PlazaBadge.Visibility = c.InPlaza ? Visibility.Visible : Visibility.Collapsed;
        CodeText.Text = c.Code;
        CreatedText.Text = $"· 创建于 {Format.FmtDateTime(c.CreatedAt)}";
        TitleText.Text = c.Title;

        CreatorAvatar.Background = Avatars.Brush(c.Creator.AvatarId);
        CreatorName.Text = c.Creator.Nickname;
        FavButton.Content = CardFmt.FavText(c.FavoritedByMe, c.FavoriteCount);

        if (c.IsOpened && c.Content != null)
        {
            OpenedPanel.Visibility = Visibility.Visible;
            SealedPanel.Visibility = Visibility.Collapsed;
            OpenedAtText.Text = $"🔓 开启于 {Format.FmtDateTime(c.OpenAt)}";
            ContentText.Text = c.Content;
            _timer.Stop();
        }
        else
        {
            OpenedPanel.Visibility = Visibility.Collapsed;
            SealedPanel.Visibility = Visibility.Visible;
            OpenAtText.Text = $"开启于 {Format.FmtDateTime(c.OpenAt)}";
            Tick();
            _timer.Start();
        }
    }

    // 每秒刷新倒计时；到点后重取（拿开启后的内容）。
    private void Tick()
    {
        if (_cap is not { } c || c.IsOpened) { _timer.Stop(); return; }
        var cd = Format.CountdownTo(c.OpenAt);
        CountdownText.Text = $"{cd.Days} 天 {cd.Hours:D2}:{cd.Minutes:D2}:{cd.Seconds:D2}";
        if (cd.Expired)
        {
            CountdownText.Text = "正在开启…";
            _timer.Stop();
            _ = LoadAsync(showLoading: false);
        }
    }

    private void SetStatus(string msg, bool showBack)
    {
        StatusPanel.Visibility = Visibility.Visible;
        DetailPanel.Visibility = Visibility.Collapsed;
        StatusText.Text = msg;
        BackToOpen.Visibility = showBack ? Visibility.Visible : Visibility.Collapsed;
    }

    private void OnBackToOpen(object sender, RoutedEventArgs e) => Store.Navigate(Route.Open);

    private void OnCopyCode(object sender, RoutedEventArgs e)
    {
        if (_cap is not { } c) return;
        var pkg = new DataPackage();
        pkg.SetText(c.Code);
        Clipboard.SetContent(pkg);
        CopyCodeButton.Content = "✓ 已复制!";
    }

    private async void OnToggleFavorite(object sender, RoutedEventArgs e)
    {
        if (_cap is not { } c) return;
        if (!Store.IsAuthenticated) { Store.RequireLogin(); return; }
        try
        {
            if (c.FavoritedByMe)
            {
                await Store.Api.UnfavoriteAsync(c.Id);
                _cap = c with { FavoritedByMe = false, FavoriteCount = Math.Max(0, c.FavoriteCount - 1) };
            }
            else
            {
                var r = await Store.Api.FavoriteAsync(c.Id);
                _cap = c with { FavoritedByMe = true, FavoriteCount = r.FavoriteCount };
            }
            FavButton.Content = CardFmt.FavText(_cap.FavoritedByMe, _cap.FavoriteCount);
        }
        catch (ApiException ex) { Store.Report(ex); }
    }
}
