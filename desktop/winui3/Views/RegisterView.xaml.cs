using System;
using System.Linq;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using HelloTimePro.Api;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class RegisterView : UserControl
{
    private AppStore Store => App.Store;

    public RegisterView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var avatars = await Store.Api.AvatarsAsync();
            AvatarGrid.ItemsSource = avatars;
            if (avatars.Count > 0) AvatarGrid.SelectedIndex = 0;
        }
        catch { /* 头像加载失败不阻断注册 */ }
    }

    private async void OnSubmit(object sender, RoutedEventArgs e)
    {
        ErrorText.Visibility = Visibility.Collapsed;
        var email = EmailBox.Text.Trim();
        var nickname = NicknameBox.Text.Trim();
        var password = PasswordBox.Password;
        var avatarId = (AvatarGrid.SelectedItem as Avatar)?.Id;

        if (email.Length == 0 || nickname.Length == 0 || password.Length == 0)
        {
            ShowError("请填写邮箱、昵称和密码");
            return;
        }
        if (avatarId == null)
        {
            ShowError("请选择头像");
            return;
        }

        SubmitButton.IsEnabled = false;
        SubmitButton.Content = "注册中…";
        try
        {
            await Store.RegisterAsync(email, password, nickname, avatarId);
        }
        catch (ApiException ex)
        {
            ShowError(ex.Message);
        }
        catch (Exception)
        {
            ShowError("注册失败");
        }
        finally
        {
            SubmitButton.IsEnabled = true;
            SubmitButton.Content = "注册";
        }
    }

    private void ShowError(string msg)
    {
        ErrorText.Text = msg;
        ErrorText.Visibility = Visibility.Visible;
    }

    private void OnGoLogin(object sender, RoutedEventArgs e) => Store.Navigate(Route.Login);
}
