using System;
using System.IO;
using System.Text.Json;

namespace HelloTimePro.Stores;

// ============================================================
// LocalStore：极简本地持久化（对齐 Web 的 localStorage / swiftui 的 UserDefaults）。
//
// 非打包（unpackaged）WinUI3 不能用 Windows.Storage.ApplicationData.Current（会抛异常），
// 故落地为 %LOCALAPPDATA%\HelloTimePro\<key>.json 文件。教学版持久化 refresh token + user
// （对应 docs/02-design §7.2 的「更简单方案」）。
// ============================================================
public static class LocalStore
{
    private static readonly string Dir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HelloTimePro");

    private static string PathFor(string key) => Path.Combine(Dir, $"{key}.json");

    public static void Save<T>(string key, T value)
    {
        try
        {
            Directory.CreateDirectory(Dir);
            File.WriteAllText(PathFor(key), JsonSerializer.Serialize(value));
        }
        catch { /* 持久化失败不影响会话 */ }
    }

    public static T? Load<T>(string key)
    {
        try
        {
            var p = PathFor(key);
            if (!File.Exists(p)) return default;
            return JsonSerializer.Deserialize<T>(File.ReadAllText(p));
        }
        catch { return default; }
    }

    public static void Remove(string key)
    {
        try { var p = PathFor(key); if (File.Exists(p)) File.Delete(p); }
        catch { /* ignore */ }
    }
}
