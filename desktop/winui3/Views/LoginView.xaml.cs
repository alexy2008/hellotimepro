using System;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using HelloTimePro.Api;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class LoginView : UserControl
{
    private AppStore Store => App.Store;

    public LoginView() => InitializeComponent();

    private async void OnSubmit(object sender, RoutedEventArgs e)
    {
        ErrorText.Visibility = Visibility.Collapsed;
        var email = EmailBox.Text.Trim();
        var password = PasswordBox.Password;
        if (email.Length == 0 || password.Length == 0)
        {
            ShowError("请输入邮箱和密码");
            return;
        }

        SubmitButton.IsEnabled = false;
        SubmitButton.Content = "登录中…";
        try
        {
            await Store.LoginAsync(email, password);
        }
        catch (ApiException ex)
        {
            ShowError(ex.Message);
        }
        catch (Exception)
        {
            ShowError("登录失败");
        }
        finally
        {
            SubmitButton.IsEnabled = true;
            SubmitButton.Content = "登录";
        }
    }

    private void ShowError(string msg)
    {
        ErrorText.Text = msg;
        ErrorText.Visibility = Visibility.Visible;
    }

    private void OnGoRegister(object sender, RoutedEventArgs e) => Store.Navigate(Route.Register);
}
