using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using HelloTimePro.Api;
using HelloTimePro.Models;

namespace HelloTimePro.Stores;

// ============================================================
// AppStore：全局会话 + 导航 + 主题 + 提示（对齐 desktop/swiftui 的 AppStore，
// 即 React 的 auth/theme store + router 的原生整合）。
//
// 鉴权（完整功能）：access token 内存；refresh token + user 持久化（LocalStore）；
// 启动 hydrate，有 refresh token 则拉 /me 校验；401 自动 refresh（ApiClient 回调）。
// plaza/capsule 列表数据不进 store，由各页面自取（同 swiftui）。
// ============================================================

public enum RouteKind
{
    Plaza, Open, About, Create, Login, Register,
    MeCreated, MeFavorites, MeProfile, Capsule,
}

public sealed record Route(RouteKind Kind, string? Code = null)
{
    public bool RequiresAuth => Kind is RouteKind.Create or RouteKind.MeCreated
        or RouteKind.MeFavorites or RouteKind.MeProfile;

    // 顶部导航点的是「根」路由（替换栈）；胶囊详情是「压栈」。
    public bool IsRoot => Kind != RouteKind.Capsule;

    public static readonly Route Plaza = new(RouteKind.Plaza);
    public static readonly Route Open = new(RouteKind.Open);
    public static readonly Route About = new(RouteKind.About);
    public static readonly Route Create = new(RouteKind.Create);
    public static readonly Route Login = new(RouteKind.Login);
    public static readonly Route Register = new(RouteKind.Register);
    public static readonly Route MeCreated = new(RouteKind.MeCreated);
    public static readonly Route MeFavorites = new(RouteKind.MeFavorites);
    public static readonly Route MeProfile = new(RouteKind.MeProfile);
    public static Route Capsule(string code) => new(RouteKind.Capsule, code);
}

public enum AppTheme { Dark, Light }

public sealed class AppStore : INotifyPropertyChanged
{
    public ApiClient Api { get; } = new();

    // 会话
    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }

    private User? _currentUser;
    public User? CurrentUser
    {
        get => _currentUser;
        private set { _currentUser = value; OnChanged(); OnChanged(nameof(IsAuthenticated)); }
    }

    // 主题
    private AppTheme _theme = AppTheme.Dark;
    public AppTheme Theme
    {
        get => _theme;
        private set { _theme = value; OnChanged(); }
    }

    // 导航栈
    private readonly List<Route> _path = new() { Route.Plaza };
    private Route? _pendingRoute;

    public Route Current => _path.Count > 0 ? _path[^1] : Route.Plaza;
    public bool CanGoBack => _path.Count > 1;
    public bool IsAuthenticated => AccessToken != null && CurrentUser != null;
    public string ApiBaseDescription => Api.BaseUrl.ToString();

    // 全局提示
    private string? _banner;
    public string? Banner
    {
        get => _banner;
        set { _banner = value; OnChanged(); }
    }

    private const string AuthKey = "auth";
    private const string ThemeKey = "theme";

    /// 导航变化事件：外壳据此切换 Frame / 内容（比逐个绑定 Current 更直接）。
    public event Action? NavigationChanged;

    public AppStore()
    {
        Api.GetAccessToken = () => AccessToken;
        Api.GetRefreshToken = () => RefreshToken;
        Api.OnTokensRefreshed = PatchTokens;
        Api.OnAuthLost = ClearSession;
    }

    // ---------- 启动 ----------

    public void Bootstrap()
    {
        HydrateTheme();
        HydrateAuth();
        if (RefreshToken != null) _ = RefreshMeAsync();
    }

    // ---------- 导航 ----------

    public void Navigate(Route route)
    {
        if (route.RequiresAuth && !IsAuthenticated)
        {
            _pendingRoute = route;
            SetPath(Route.Login);
            return;
        }
        if (route.IsRoot) SetPath(route);
        else { _path.Add(route); RaiseNav(); }
    }

    public void Push(Route route) { _path.Add(route); RaiseNav(); }

    public void GoBack()
    {
        if (_path.Count > 1) { _path.RemoveAt(_path.Count - 1); RaiseNav(); }
    }

    /// 匿名触发需登录动作（如收藏）时跳登录。
    public void RequireLogin() { _pendingRoute = null; SetPath(Route.Login); }

    private void SetPath(Route route)
    {
        _path.Clear();
        _path.Add(route);
        RaiseNav();
    }

    private void RaiseNav()
    {
        OnChanged(nameof(Current));
        OnChanged(nameof(CanGoBack));
        NavigationChanged?.Invoke();
    }

    // ---------- 鉴权 ----------

    public async Task LoginAsync(string email, string password) =>
        Apply(await Api.LoginAsync(new LoginRequest(email, password)), Route.MeCreated);

    public async Task RegisterAsync(string email, string password, string nickname, string avatarId) =>
        Apply(await Api.RegisterAsync(new RegisterRequest(email, password, nickname, avatarId)), Route.Create);

    public async Task LogoutAsync()
    {
        var rt = RefreshToken;
        ClearSession();
        if (rt != null) { try { await Api.LogoutAsync(rt); } catch { /* 忽略 */ } }
        SetPath(Route.Plaza);
    }

    public async Task RefreshMeAsync()
    {
        try
        {
            CurrentUser = await Api.MeAsync();
            PersistAuth();
        }
        catch { /* 401 走 OnAuthLost */ }
    }

    private void Apply(AuthTokens tokens, Route defaultRoute)
    {
        AccessToken = tokens.AccessToken;
        RefreshToken = tokens.RefreshToken;
        CurrentUser = tokens.User;
        PersistAuth();
        var target = _pendingRoute ?? defaultRoute;
        _pendingRoute = null;
        SetPath(target);
    }

    private void PatchTokens(string a, string r)
    {
        AccessToken = a;
        RefreshToken = r;
        PersistAuth();
    }

    private void ClearSession()
    {
        AccessToken = null;
        RefreshToken = null;
        CurrentUser = null;
        LocalStore.Remove(AuthKey);
    }

    /// 资料修改后合并更新当前用户。
    public void SetCurrentUser(User u) { CurrentUser = u; PersistAuth(); }

    public void Report(Exception error)
    {
        if (error is ApiException e && e.IsUnauthorized)
        {
            ClearSession();
            Banner = "登录已过期，请重新登录";
        }
        else
        {
            Banner = error.Message.Length > 0 ? error.Message : "发生未知错误";
        }
    }

    // ---------- 主题 ----------

    public void ToggleTheme()
    {
        Theme = Theme == AppTheme.Dark ? AppTheme.Light : AppTheme.Dark;
        LocalStore.Save(ThemeKey, Theme.ToString());
    }

    private void HydrateTheme()
    {
        var raw = LocalStore.Load<string>(ThemeKey);
        if (Enum.TryParse<AppTheme>(raw, out var t)) Theme = t;
    }

    // ---------- 持久化 ----------

    private sealed record PersistedAuth(string RefreshToken, User User);

    private void PersistAuth()
    {
        if (RefreshToken is { } rt && CurrentUser is { } u)
            LocalStore.Save(AuthKey, new PersistedAuth(rt, u));
    }

    private void HydrateAuth()
    {
        var p = LocalStore.Load<PersistedAuth>(AuthKey);
        if (p != null)
        {
            RefreshToken = p.RefreshToken;
            CurrentUser = p.User;
        }
    }

    // ---------- INotifyPropertyChanged ----------

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnChanged([CallerMemberName] string? name = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
