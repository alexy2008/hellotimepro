<?php

namespace App\Services;

/**
 * 头像目录（2.0）：从 spec/avatars/v2/catalog.json 读取内置头像，并内联提取单线 SVG 徽记，
 * 让两套皮肤可以用 currentColor 着色（直接 <img> 引用只会渲染成黑色）。
 * 单例绑定（见 AppServiceProvider），避免每次请求重复读盘。
 */
class AvatarCatalog
{
    /** @var array<int, array{id: string, name: string, primaryColor: string, svgUrl: string, tagline?: string}> */
    private array $avatars = [];

    /** @var array<string, array{id: string, name: string, color: string, tagline: string, svgUrl: string, glyph: string}> */
    private array $uiIndex = [];

    public function __construct()
    {
        $dir = $this->appRoot() . '/spec/avatars/v2';
        $path = $dir . '/catalog.json';
        $json = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
        $list = is_array($json['avatars'] ?? null) ? $json['avatars'] : [];

        foreach ($list as $item) {
            if (!is_array($item) || empty($item['id'])) {
                continue;
            }
            $id = (string) $item['id'];
            $name = (string) ($item['name'] ?? $id);
            $color = (string) ($item['primaryColor'] ?? '#4a7c59');
            $svgUrl = (string) ($item['svgUrl'] ?? "/static/avatars/{$id}.svg");
            $tagline = (string) ($item['tagline'] ?? '');

            $this->avatars[] = [
                'id' => $id,
                'name' => $name,
                'primaryColor' => $color,
                'svgUrl' => $svgUrl,
            ];

            $svgFile = $dir . '/' . $id . '.svg';
            $rawSvg = is_file($svgFile) ? (string) file_get_contents($svgFile) : '';
            $this->uiIndex[$id] = [
                'id' => $id,
                'name' => $name,
                'color' => $color,
                'tagline' => $tagline,
                'svgUrl' => $svgUrl,
                'glyph' => $this->extractInner($rawSvg),
            ];
        }
    }

    /** 供 /api/v1/avatars 返回，严格对齐 OpenAPI Avatar 结构。 */
    public function all(): array
    {
        return $this->avatars;
    }

    /** 供 Blade / 前端渲染的完整列表（含内联 glyph 与 tagline）。 */
    public function allForUi(): array
    {
        return array_values($this->uiIndex);
    }

    /** 按 ID 查头像（含 glyph），找不到时回退到第一个头像。 */
    public function find(?string $id): array
    {
        if ($id !== null && isset($this->uiIndex[$id])) {
            return $this->uiIndex[$id];
        }
        return reset($this->uiIndex) ?: [
            'id' => 'neo',
            'name' => '新生',
            'color' => '#4a7c59',
            'tagline' => '破土的芽',
            'svgUrl' => '/static/avatars/neo.svg',
            'glyph' => '',
        ];
    }

    public function valid(string $avatarId): bool
    {
        return isset($this->uiIndex[$avatarId]);
    }

    private function extractInner(string $svg): string
    {
        if ($svg === '') {
            return '';
        }
        $inner = preg_replace('/\A[\s\S]*?<svg[^>]*>/i', '', $svg) ?? $svg;
        $inner = preg_replace('/<\/svg>\s*\z/i', '', $inner) ?? $inner;
        $inner = preg_replace('/<title>[\s\S]*?<\/title>/i', '', $inner) ?? $inner;
        return trim($inner);
    }

    private function appRoot(): string
    {
        $fromEnv = getenv('APP_ROOT');
        if (is_string($fromEnv) && $fromEnv !== '') {
            return $fromEnv;
        }
        return (string) (env('APP_ROOT') ?: dirname(base_path(), 2));
    }
}
