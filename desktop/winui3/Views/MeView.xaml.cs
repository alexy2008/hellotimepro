using System;
using System.Collections.ObjectModel;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Microsoft.UI.Xaml.Media;
using Windows.UI;
using HelloTimePro.Api;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class MeView : UserControl
{
    private AppStore Store => App.Store;
    private static readonly SolidColorBrush ActiveBg = new(Color.FromArgb(0xFF, 0x6B, 0x46, 0xFF));

    private readonly RouteKind _kind;
    private readonly ObservableCollection<CapsuleListItem> _items = new();

    public MeView(RouteKind kind)
    {
        InitializeComponent();
        _kind = kind;
        CardGrid.ItemsSource = _items;
        CardGrid.RightTapped += OnCardRightTapped;
        HighlightTabs();
        Loaded += async (_, _) => await LoadAsync();
    }

    private void HighlightTabs()
    {
        StyleTab(TabCreated, _kind == RouteKind.MeCreated);
        StyleTab(TabFavorites, _kind == RouteKind.MeFavorites);
        StyleTab(TabProfile, _kind == RouteKind.MeProfile);
    }

    private static void StyleTab(Button b, bool active)
    {
        if (active)
        {
            b.Background = ActiveBg;
            b.Foreground = new SolidColorBrush(Colors.White);
        }
        else
        {
            b.ClearValue(Control.BackgroundProperty);
            b.ClearValue(Control.ForegroundProperty);
        }
    }

    private async System.Threading.Tasks.Task LoadAsync()
    {
        if (_kind == RouteKind.MeProfile) { await LoadProfileAsync(); return; }

        ListSection.Visibility = Visibility.Visible;
        SetStatus("加载中…");
        try
        {
            var page = _kind == RouteKind.MeCreated
                ? await Store.Api.MyCapsulesAsync(1)
                : await Store.Api.MyFavoritesAsync(1);
            _items.Clear();
            foreach (var c in page.Items) _items.Add(c);
            if (_items.Count == 0)
                SetStatus(_kind == RouteKind.MeCreated ? "你还没有创建过胶囊。" : "你还没有收藏任何胶囊。");
            else HideStatus();
        }
        catch (ApiException ex) { SetStatus(ex.Message); }
        catch (Exception) { SetStatus("加载失败"); }
    }

    private void OnCardClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is CapsuleListItem c) Store.Navigate(Route.Capsule(c.Code));
    }

    // 我创建的：右键撤回（删除）。
    private async void OnCardRightTapped(object sender, RightTappedRoutedEventArgs e)
    {
        if (_kind != RouteKind.MeCreated) return;
        if ((e.OriginalSource as FrameworkElement)?.DataContext is not CapsuleListItem c) return;

        var dialog = new ContentDialog
        {
            Title = "撤回胶囊",
            Content = $"确定要删除「{c.Title}」吗？此操作不可恢复。",
            PrimaryButtonText = "删除",
            CloseButtonText = "取消",
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = XamlRoot,
        };
        if (await dialog.ShowAsync() == ContentDialogResult.Primary)
        {
            try
            {
                await Store.Api.DeleteCapsuleAsync(c.Id);
                _items.Remove(c);
                if (_items.Count == 0) SetStatus("你还没有创建过胶囊。");
            }
            catch (ApiException ex) { Store.Report(ex); }
        }
    }

    // ---------- 资料 ----------

    private async System.Threading.Tasks.Task LoadProfileAsync()
    {
        ProfileSection.Visibility = Visibility.Visible;
        var user = Store.CurrentUser;
        if (user != null) NicknameBox.Text = user.Nickname;
        try
        {
            var avatars = await Store.Api.AvatarsAsync();
            AvatarGrid.ItemsSource = avatars;
            for (int i = 0; i < avatars.Count; i++)
                if (avatars[i].Id == user?.AvatarId) { AvatarGrid.SelectedIndex = i; break; }
        }
        catch { /* 头像加载失败不阻断 */ }
    }

    private async void OnSaveProfile(object sender, RoutedEventArgs e)
    {
        HideMsg();
        var nickname = NicknameBox.Text.Trim();
        var avatarId = (AvatarGrid.SelectedItem as Avatar)?.Id;
        if (nickname.Length == 0) { ShowMsg("昵称不能为空", false); return; }

        SaveProfileButton.IsEnabled = false;
        try
        {
            var updated = await Store.Api.UpdateProfileAsync(new UpdateProfileRequest(nickname, avatarId));
            Store.SetCurrentUser(updated);
            ShowMsg("资料已保存", true);
        }
        catch (ApiException ex) { ShowMsg(ex.Message, false); }
        catch (Exception) { ShowMsg("保存失败", false); }
        finally { SaveProfileButton.IsEnabled = true; }
    }

    private async void OnChangePassword(object sender, RoutedEventArgs e)
    {
        HideMsg();
        var cur = CurrentPwd.Password;
        var neu = NewPwd.Password;
        if (cur.Length == 0 || neu.Length == 0) { ShowMsg("请输入当前密码和新密码", false); return; }

        ChangePwdButton.IsEnabled = false;
        try
        {
            await Store.Api.ChangePasswordAsync(new ChangePasswordRequest(cur, neu));
            CurrentPwd.Password = "";
            NewPwd.Password = "";
            ShowMsg("密码已更新", true);
        }
        catch (ApiException ex) { ShowMsg(ex.Message, false); }
        catch (Exception) { ShowMsg("更新失败", false); }
        finally { ChangePwdButton.IsEnabled = true; }
    }

    // ---------- 导航 / 状态 ----------

    private void OnTabCreated(object s, RoutedEventArgs e) => Store.Navigate(Route.MeCreated);
    private void OnTabFavorites(object s, RoutedEventArgs e) => Store.Navigate(Route.MeFavorites);
    private void OnTabProfile(object s, RoutedEventArgs e) => Store.Navigate(Route.MeProfile);

    private void SetStatus(string msg)
    {
        StatusText.Text = msg;
        StatusText.Visibility = Visibility.Visible;
        CardGrid.Visibility = Visibility.Collapsed;
    }

    private void HideStatus()
    {
        StatusText.Visibility = Visibility.Collapsed;
        CardGrid.Visibility = Visibility.Visible;
    }

    private void ShowMsg(string msg, bool ok)
    {
        ProfileMsg.Text = msg;
        ProfileMsg.Foreground = new SolidColorBrush(ok ? Color.FromArgb(0xFF, 0x5E, 0xD4, 0x9A) : Color.FromArgb(0xFF, 0xD4, 0x7A, 0x7A));
        ProfileMsg.Visibility = Visibility.Visible;
    }

    private void HideMsg() => ProfileMsg.Visibility = Visibility.Collapsed;
}
