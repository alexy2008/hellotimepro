using System;
using System.Text.RegularExpressions;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.ApplicationModel.DataTransfer;
using HelloTimePro.Api;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class OpenView : UserControl
{
    private AppStore Store => App.Store;
    private bool _busy;

    public OpenView() => InitializeComponent();

    private void OnCodeChanged(object sender, TextChangedEventArgs e)
    {
        // 仅保留大写字母与数字，最多 8 位。
        var filtered = Regex.Replace(CodeBox.Text.ToUpperInvariant(), "[^A-Z0-9]", "");
        if (filtered.Length > 8) filtered = filtered.Substring(0, 8);
        if (filtered != CodeBox.Text)
        {
            CodeBox.Text = filtered;
            CodeBox.SelectionStart = filtered.Length;
        }
        OpenButton.IsEnabled = filtered.Length == 8 && !_busy;
        ErrorText.Visibility = Visibility.Collapsed;
    }

    private async void OnOpen(object sender, RoutedEventArgs e) => await OpenAsync(CodeBox.Text);

    private async System.Threading.Tasks.Task OpenAsync(string code)
    {
        if (code.Length != 8 || _busy) return;
        _busy = true;
        OpenButton.IsEnabled = false;
        OpenButton.Content = "查询中…";
        ErrorText.Visibility = Visibility.Collapsed;
        try
        {
            var cap = await Store.Api.CapsuleByCodeAsync(code);
            Store.Navigate(Route.Capsule(cap.Code));
        }
        catch (ApiException ex)
        {
            ShowError(ex.Message);
        }
        catch (Exception)
        {
            ShowError("找不到这条胶囊");
        }
        finally
        {
            _busy = false;
            OpenButton.Content = "开启 →";
            OpenButton.IsEnabled = CodeBox.Text.Length == 8;
        }
    }

    private async void OnPaste(object sender, RoutedEventArgs e)
    {
        try
        {
            var content = Clipboard.GetContent();
            if (content.Contains(StandardDataFormats.Text))
            {
                var text = await content.GetTextAsync();
                var filtered = Regex.Replace(text.ToUpperInvariant(), "[^A-Z0-9]", "");
                if (filtered.Length > 8) filtered = filtered.Substring(0, 8);
                CodeBox.Text = filtered;
                if (filtered.Length == 8) await OpenAsync(filtered);
            }
        }
        catch { ShowError("粘贴失败"); }
    }

    private void ShowError(string msg)
    {
        ErrorText.Text = msg;
        ErrorText.Visibility = Visibility.Visible;
    }
}
