<?php

namespace App\Models;

use App\Models\Concerns\HasCrossDbKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Refresh token（带 family_id 家族追踪，用于轮转与重用检测）。
 * token 本身不入库，仅存 SHA-256 摘要；revoked_at 为空表示有效。
 */
class RefreshToken extends Model
{
    use HasCrossDbKey;

    protected $table = 'refresh_tokens';

    protected $fillable = ['user_id', 'token_hash', 'family_id', 'expires_at', 'created_at', 'revoked_at'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
