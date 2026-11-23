<?php

namespace App\Support;

/**
 * 页面层共享常量与纯函数：线性图标 SVG 路径（24 网格）、关于页共用文案（对齐 spec/ui/copy.md §5）
 * 与登录回跳安全校验。供 Blade 模板与服务端控制器共用。
 */
class UiHelper
{
    public const ICONS = [
        'arrow' => '<path d="M5 12h14M13 6l6 6-6 6"/>',
        'arrow-left' => '<path d="M19 12H5M11 6l-6 6 6 6"/>',
        'search' => '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
        'heart' => '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
        'key' => '<circle cx="7.5" cy="16.5" r="4"/><path d="M10.4 13.6 20 4M17 7l2.5 2.5M14.2 9.8l2 2"/>',
        'copy' => '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
        'link' => '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
        'sun' => '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
        'moon' => '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
        'plus' => '<path d="M12 5v14M5 12h14"/>',
        'x' => '<path d="M6 6l12 12M18 6 6 18"/>',
        'check' => '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
        'chev-down' => '<path d="m6 9 6 6 6-6"/>',
        'chev-left' => '<path d="m15 6-6 6 6 6"/>',
        'chev-right' => '<path d="m9 6 6 6-6 6"/>',
        'user' => '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5"/>',
        'logout' => '<path d="M10 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h4"/><path d="M10 12h9.5M16 8l4 4-4 4"/>',
        'sliders' => '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
        'pen' => '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20z"/><path d="m14.5 6 3 3"/>',
        'sparkle' => '<path d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4L20.5 12 15 13.6a2 2 0 0 0-1.4 1.4L12 20.5 10.4 15A2 2 0 0 0 9 13.6L3.5 12 9 10.4A2 2 0 0 0 10.4 9L12 3.5z"/>',
        'refresh' => '<path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9"/><path d="M18 3.5v4h-4M6 20.5v-4h4"/>',
        'trash' => '<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10 10.5v6M14 10.5v6"/>',
        'eye' => '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
        'eye-off' => '<path d="M4 4l16 16M9.9 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.3 7.6A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
        'compass' => '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>',
        'clock' => '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
        'lock' => '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
        'globe' => '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
        'info' => '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
        'alert' => '<path d="M12 4 21 19.5H3L12 4z"/><path d="M12 10v4.5M12 17v.2"/>',
        'mail' => '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 6.5 8 6.5 8-6.5"/>',
        'grid' => '<path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z"/>',
        'paste' => '<rect x="6" y="5" width="12" height="15.5" rx="1.5"/><path d="M9.5 5V3.5h5V5M9 10h6M9 13.5h6M9 17h3.5"/>',
        'external' => '<path d="M13 5h6v6M19 5l-8.5 8.5M10 6H6.5A1.5 1.5 0 0 0 5 7.5v10A1.5 1.5 0 0 0 6.5 19h10a1.5 1.5 0 0 0 1.5-1.5V14"/>',
        'calendar' => '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
        'fire' => '<path d="M12 21c3.6 0 6.5-2.6 6.5-6.3 0-4.2-3.4-5.7-3.8-9.7-2.2 1-3.9 3.2-4 5.6-1-.6-1.6-1.7-1.7-2.8C7 9.3 5.5 11.7 5.5 14.7 5.5 18.4 8.4 21 12 21z"/>',
        'book' => '<path d="M5 4.5h11A2.5 2.5 0 0 1 18.5 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5h11"/>',
        'hourglass' => '<path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 5 9 6 9 8.5s-9 3.5-9 8.5M16.5 3.5c0 5-9 6-9 8.5s9 3.5 9 8.5"/>',
        'mail-open' => '<path d="M3.5 10 12 4.5l8.5 5.5v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="m3.8 10.2 8.2 5.3 8.2-5.3"/>',
        'unlock' => '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8"/>',
        'feather' => '<path d="M20 4c-6 0-11.5 4.5-12.5 11.5L5 20"/><path d="M8 15.5h6.5M11 11.5h6"/>',
        'layers' => '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
        'code' => '<path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5"/>',
        'server' => '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
        'database' => '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
        'palette' => '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.6-.8 1.6-1.6 0-1.3-1-1.4-1-2.6 0-.9.7-1.6 1.6-1.6h2a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.6-7.4-8-7.4z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.8" r="1"/>',
        'shield' => '<path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    ];

    public const FEATURES = [
        ['user', '账号与头像', '邮箱注册即登录；十个内置头像，昵称全站唯一。'],
        ['pen', '写一枚胶囊', '标题、正文、开启时间；没有头绪时，AI 给灵感，也能代笔。'],
        ['hourglass', '倒计时与自动开启', '没到时间只显示倒计时；归零的那一刻，胶囊自己打开。'],
        ['globe', '胶囊广场', '公开的胶囊陈列在这里，可搜索、筛选，按最新或最热排序。'],
        ['heart', '收藏与「我的」', '收藏任何一枚胶囊，等它开启；在「我的」里管理写过的每一枚。'],
        ['sparkle', '两套皮肤，昼夜两色', '「时笺」与「琥珀」随时切换，各有明暗两套主题，并记住你的选择。'],
    ];

    public const TENETS = [
        ['规范即唯一事实源', '业务契约放在 <code class="mono">spec/</code> 下：OpenAPI、数据库 schema、设计令牌。代码只是规范的投影，有歧义先改规范。'],
        ['栈内地道', 'Signals、组合式、Hooks、Runes、Compose……每个实现都用自己技术栈的惯用写法，而不是把同一份代码翻译十遍。'],
        ['外部一致', '无论内部怎么写，对外的路由、JSON 形状、错误码与界面必须一致——肉眼可比，才谈得上对比。'],
        ['黑盒验证', '契约用例与 UI 冒烟都从外部跑，不信任任何实现的自述；每个后端都要在 PostgreSQL 与 SQLite 上各过一遍。'],
    ];

    public const ROLE_LABELS = [
        'language' => '语言',
        'framework' => '框架',
        'orm' => 'ORM',
        'template' => '模板引擎',
        'enhancement' => '渐进增强',
        'database' => '数据库',
        'styling' => '样式',
    ];

    public const TECH_NOTES = [
        'PHP' => 'Web 服务端久经考验的动态脚本语言，8.x 引入强类型、属性与只读类',
        'Laravel' => 'PHP 生态最具代表性的全栈框架，路由、容器、服务与测试开箱即用',
        'Eloquent' => 'Laravel 招牌的 ActiveRecord ORM，模型、关系与自定义 Cast 表达清晰',
        'Blade' => '编译为原生 PHP 的服务端模板引擎，支持组件、布局与双皮肤视图拆分',
        'Alpine.js' => '贴近 HTML 的轻量响应式框架，用极小体积承担换肤、倒计时与交互状态',
        'PostgreSQL' => '功能丰富的开源关系型数据库，行锁与事务能力完善',
        'SQLite' => '零配置嵌入式关系型数据库，单文件即可承载完整契约与双皮肤体验',
    ];

    public static function icon(string $name, string $class = ''): string
    {
        $paths = self::ICONS[$name] ?? '';
        $cls = $class !== '' ? "ic {$class}" : 'ic';
        return '<svg class="' . htmlspecialchars($cls, ENT_QUOTES, 'UTF-8') . '" viewBox="0 0 24 24" aria-hidden="true">' . $paths . '</svg>';
    }

    public static function safeRedirect(?string $raw, string $fallback = '/'): string
    {
        if (!$raw || !str_starts_with($raw, '/') || str_starts_with($raw, '//') || str_starts_with($raw, '/\\')) {
            return $fallback;
        }
        return $raw;
    }

    public static function loginRedirectUrl(string $path): string
    {
        return '/login?redirect=' . rawurlencode($path);
    }
}
