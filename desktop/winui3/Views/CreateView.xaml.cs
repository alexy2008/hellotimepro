using System;
using System.Globalization;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using HelloTimePro.Api;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class CreateView : UserControl
{
    private AppStore Store => App.Store;
    private bool _aiGenerated;
    private bool _recoLoaded;

    public CreateView()
    {
        InitializeComponent();
        SetOpenAt(DateTimeOffset.Now.AddHours(1));
        TitleBox.TextChanged += (_, _) => UpdateRecoVisibility();
        Loaded += async (_, _) => await LoadRecosAsync();
    }

    private void OnContentChanged(object sender, TextChangedEventArgs e) =>
        ContentCount.Text = $"{ContentBox.Text.Length} / 5000";

    // ---------- 时间 ----------

    private void SetOpenAt(DateTimeOffset dt)
    {
        var local = dt.ToLocalTime();
        OpenDate.Date = local;
        OpenTime.Time = local.TimeOfDay;
    }

    private string OpenAtIso()
    {
        var d = OpenDate.Date;
        var t = OpenTime.Time;
        var local = new DateTimeOffset(d.Year, d.Month, d.Day, t.Hours, t.Minutes, 0, DateTimeOffset.Now.Offset);
        return local.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
    }

    private void OnPreset1Min(object s, RoutedEventArgs e) => SetOpenAt(DateTimeOffset.Now.AddSeconds(130));
    private void OnPreset1Hour(object s, RoutedEventArgs e) => SetOpenAt(DateTimeOffset.Now.AddHours(1));
    private void OnPreset1Year(object s, RoutedEventArgs e) => SetOpenAt(DateTimeOffset.Now.AddYears(1));
    private void OnPresetTomorrow(object s, RoutedEventArgs e)
    {
        var t = DateTimeOffset.Now.AddDays(1);
        SetOpenAt(new DateTimeOffset(t.Year, t.Month, t.Day, 9, 0, 0, t.Offset));
    }

    // ---------- AI ----------

    private async void OnAiGenerate(object sender, RoutedEventArgs e) => await RunAiAsync(TitleBox.Text);

    private async System.Threading.Tasks.Task RunAiAsync(string rawTitle)
    {
        var t = rawTitle.Trim();
        var autoTitle = t.Length == 0;
        HideError();
        AiInfo.Visibility = Visibility.Collapsed;
        AiButton.IsEnabled = false;
        AiButton.Content = "生成中…";
        try
        {
            var s = await Store.Api.SuggestCapsuleAsync(t.Length == 0 ? null : t);
            ContentBox.Text = s.Content;
            if (DateTimeOffset.TryParse(s.OpenAt, CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var openAt))
                SetOpenAt(openAt);
            if (!string.IsNullOrEmpty(s.Title) && autoTitle && TitleBox.Text.Trim().Length == 0)
                TitleBox.Text = s.Title;
            _aiGenerated = true;
            AiButton.Content = "✨ 重新生成";

            var source = s.GeneratedBy == "local-template" ? "本地模板（LLM 未启用）" : s.GeneratedBy;
            var titleNote = !string.IsNullOrEmpty(s.Title) && autoTitle ? "标题与正文均由 AI 生成" : "已为你生成正文";
            AiInfo.Text = $"{titleNote}，建议 {s.OpenInDays} 天后开启 · 来源：{source}";
            AiInfo.Visibility = Visibility.Visible;
        }
        catch (ApiException ex) { ShowError(ex.Message); }
        catch (Exception) { ShowError("AI 生成失败，请稍后重试"); }
        finally
        {
            AiButton.IsEnabled = true;
            if (!_aiGenerated) AiButton.Content = "✨ AI 生成";
        }
    }

    // ---------- 推荐 ----------

    private async System.Threading.Tasks.Task LoadRecosAsync()
    {
        try
        {
            var list = await Store.Api.CapsuleRecommendationsAsync(4);
            if (list.Items.Count == 0) return;
            RecoChips.Children.Clear();
            foreach (var r in list.Items)
            {
                var b = new Button { Content = r.Title, Tag = r, Padding = new Thickness(12, 4, 12, 4) };
                ToolTipService.SetToolTip(b, r.Hint);
                b.Click += OnPickReco;
                RecoChips.Children.Add(b);
            }
            _recoLoaded = true;
            UpdateRecoVisibility();
        }
        catch { /* 推荐失败静默 */ }
    }

    private void UpdateRecoVisibility() =>
        RecoPanel.Visibility = (_recoLoaded && TitleBox.Text.Trim().Length == 0)
            ? Visibility.Visible : Visibility.Collapsed;

    private async void OnRefreshRecos(object sender, RoutedEventArgs e) => await LoadRecosAsync();

    private async void OnPickReco(object sender, RoutedEventArgs e)
    {
        if (sender is Button { Tag: CapsuleRecommendation r })
        {
            TitleBox.Text = r.Title;
            ContentBox.Text = "";
            _aiGenerated = false;
            await RunAiAsync(r.Title);
        }
    }

    // ---------- 提交 ----------

    private async void OnSubmit(object sender, RoutedEventArgs e)
    {
        HideError();
        var title = TitleBox.Text.Trim();
        var content = ContentBox.Text;
        if (title.Length == 0) { ShowError("请填写标题"); return; }
        if (content.Length == 0) { ShowError("请填写内容"); return; }

        SubmitButton.IsEnabled = false;
        SubmitButton.Content = "封存中…";
        try
        {
            var created = await Store.Api.CreateCapsuleAsync(
                new CreateCapsuleRequest(title, content, OpenAtIso(), PlazaToggle.IsOn));
            Store.Navigate(Route.Capsule(created.Code));
        }
        catch (ApiException ex) { ShowError(ex.Message); }
        catch (Exception) { ShowError("创建失败"); }
        finally
        {
            SubmitButton.IsEnabled = true;
            SubmitButton.Content = "🔒 上锁封存";
        }
    }

    private void OnCancel(object sender, RoutedEventArgs e) => Store.Navigate(Route.Plaza);

    private void ShowError(string msg) { ErrorText.Text = msg; ErrorText.Visibility = Visibility.Visible; }
    private void HideError() => ErrorText.Visibility = Visibility.Collapsed;
}
