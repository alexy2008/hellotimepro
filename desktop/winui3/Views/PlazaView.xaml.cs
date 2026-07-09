using System;
using System.Collections.ObjectModel;
using Microsoft.UI;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using Windows.UI;
using HelloTimePro.Api;
using HelloTimePro.Models;
using HelloTimePro.Stores;

namespace HelloTimePro.Views;

public sealed partial class PlazaView : UserControl
{
    private AppStore Store => App.Store;

    private static readonly SolidColorBrush ActiveBg = new(Color.FromArgb(0xFF, 0x6B, 0x46, 0xFF));

    private readonly ObservableCollection<CapsuleListItem> _items = new();
    private string _sort = "hot";
    private string _filter = "all";
    private string _q = "";
    private int _page = 1;
    private Pagination? _pagination;

    private readonly DispatcherTimer _searchDebounce = new() { Interval = TimeSpan.FromMilliseconds(300) };

    public PlazaView()
    {
        InitializeComponent();
        CardGrid.ItemsSource = _items;
        _searchDebounce.Tick += (_, _) => { _searchDebounce.Stop(); _page = 1; _ = FetchAsync(); };
        Loaded += (_, _) => { SyncToolbar(); _ = FetchAsync(); };
    }

    private async System.Threading.Tasks.Task FetchAsync()
    {
        SetStatus("加载中…");
        try
        {
            var page = await Store.Api.PlazaAsync(_sort, _filter, _q, _page);
            _items.Clear();
            foreach (var c in page.Items) _items.Add(c);
            _pagination = page.Pagination;

            if (_items.Count == 0) SetStatus("广场暂无胶囊 —— 来当第一个写信给未来的人？");
            else HideStatus();
            UpdatePager();
        }
        catch (Exception ex)
        {
            SetStatus(ex is ApiException a ? a.Message : "加载失败");
            _pagination = null;
            UpdatePager();
        }
    }

    // ---------- 工具栏 ----------

    private void OnSortHot(object s, RoutedEventArgs e) => SetSort("hot");
    private void OnSortNew(object s, RoutedEventArgs e) => SetSort("new");
    private void OnFilterAll(object s, RoutedEventArgs e) => SetFilter("all");
    private void OnFilterOpened(object s, RoutedEventArgs e) => SetFilter("opened");
    private void OnFilterUnopened(object s, RoutedEventArgs e) => SetFilter("unopened");

    private void SetSort(string v) { if (_sort == v) return; _sort = v; _page = 1; SyncToolbar(); _ = FetchAsync(); }
    private void SetFilter(string v) { if (_filter == v) return; _filter = v; _page = 1; SyncToolbar(); _ = FetchAsync(); }

    private void OnSearchChanged(object sender, TextChangedEventArgs e)
    {
        _q = SearchBox.Text.Trim();
        _searchDebounce.Stop();
        _searchDebounce.Start();
    }

    private void SyncToolbar()
    {
        Highlight(SortHot, _sort == "hot");
        Highlight(SortNew, _sort == "new");
        Highlight(FilterAll, _filter == "all");
        Highlight(FilterOpened, _filter == "opened");
        Highlight(FilterUnopened, _filter == "unopened");
    }

    private static void Highlight(Button b, bool active)
    {
        if (active)
        {
            b.Background = ActiveBg;
            b.Foreground = new SolidColorBrush(Colors.White);
        }
        else
        {
            // ClearValue 恢复 Button 样式里的主题感知默认色；直接置 null 会让文字不可见。
            b.ClearValue(Control.BackgroundProperty);
            b.ClearValue(Control.ForegroundProperty);
        }
    }

    private void OnCardClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is CapsuleListItem c) Store.Navigate(Route.Capsule(c.Code));
    }

    // ---------- 分页 ----------

    private void OnPrev(object s, RoutedEventArgs e) { if (_page > 1) { _page--; _ = FetchAsync(); } }
    private void OnNext(object s, RoutedEventArgs e)
    {
        if (_pagination != null && _page < _pagination.TotalPages) { _page++; _ = FetchAsync(); }
    }

    private void UpdatePager()
    {
        var total = _pagination?.TotalPages ?? 0;
        if (total <= 1) { Pager.Visibility = Visibility.Collapsed; return; }
        Pager.Visibility = Visibility.Visible;
        PageText.Text = $"第 {_page} / {total} 页 · 共 {Helpers.Format.FmtNumber(_pagination!.Total)} 条";
        PrevBtn.IsEnabled = _page > 1;
        NextBtn.IsEnabled = _page < total;
    }

    // ---------- 收藏 ----------

    private async void OnToggleFavorite(object sender, RoutedEventArgs e)
    {
        if (sender is not FrameworkElement fe || fe.Tag is not string id) return;
        if (!Store.IsAuthenticated) { Store.RequireLogin(); return; }

        var idx = IndexOf(id);
        if (idx < 0) return;
        var item = _items[idx];
        try
        {
            if (item.FavoritedByMe)
            {
                await Store.Api.UnfavoriteAsync(id);
                _items[idx] = item with { FavoritedByMe = false, FavoriteCount = Math.Max(0, item.FavoriteCount - 1) };
            }
            else
            {
                var r = await Store.Api.FavoriteAsync(id);
                _items[idx] = item with { FavoritedByMe = true, FavoriteCount = r.FavoriteCount };
            }
        }
        catch (ApiException ex) { Store.Report(ex); }
    }

    private int IndexOf(string id)
    {
        for (int i = 0; i < _items.Count; i++) if (_items[i].Id == id) return i;
        return -1;
    }

    // ---------- 状态 / CTA ----------

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

    private void OnCreate(object s, RoutedEventArgs e) =>
        Store.Navigate(Store.IsAuthenticated ? Route.Create : Route.Register);
    private void OnOpen(object s, RoutedEventArgs e) => Store.Navigate(Route.Open);
}
