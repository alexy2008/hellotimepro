<?php

namespace App\Models;

use App\Models\Concerns\HasCrossDbKey;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * 用户。spec/db schema：字符串主键、password_hash/nickname/avatar_id、跨库时间戳文本。
 * 鉴权走自定义 JWT（见 AuthService），并不使用 Laravel 的 auth 守卫，但沿用 Authenticatable
 * 基类以兼容 config/auth.php 的默认 provider 配置。
 */
class User extends Authenticatable
{
    use HasCrossDbKey, HasFactory, Notifiable;

    protected $table = 'users';

    protected $fillable = ['email', 'password_hash', 'nickname', 'avatar_id', 'created_at', 'updated_at'];

    /** 避免 password_hash 被意外序列化进 toArray/toJson；属性访问仍可读。 */
    protected $hidden = ['password_hash'];

    public function capsules(): HasMany
    {
        return $this->hasMany(Capsule::class, 'owner_id');
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class, 'user_id');
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class, 'user_id');
    }
}
