<?php

namespace App\Services;

/**
 * 头像目录：从 spec/avatars/catalog.json 读取可选头像，并校验 avatarId 合法性。
 * 单例绑定（见 AppServiceProvider），避免每次解析都读盘。
 */
class AvatarCatalog
{
    private array $avatars;

    public function __construct()
    {
        $path = $this->appRoot() . '/spec/avatars/catalog.json';
        $json = is_file($path) ? json_decode((string) file_get_contents($path), true) : [];
        $this->avatars = $json['avatars'] ?? [];
    }

    public function all(): array
    {
        return $this->avatars;
    }

    public function valid(string $avatarId): bool
    {
        foreach ($this->avatars as $item) {
            if (($item['id'] ?? '') === $avatarId) {
                return true;
            }
        }
        return false;
    }

    private function appRoot(): string
    {
        return env('APP_ROOT') ?: dirname(base_path(), 2);
    }
}
