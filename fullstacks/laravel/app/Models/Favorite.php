<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 收藏（用户 ↔ 胶囊）。复合主键 (user_id, capsule_id)，Eloquent 不原生支持复合键的
 * find()，故本模型只通过 where/create/delete 访问，不依赖单一主键解析。
 */
class Favorite extends Model
{
    protected $table = 'favorites';

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $primaryKey = 'user_id';

    protected $fillable = ['user_id', 'capsule_id', 'created_at'];

    public function capsule(): BelongsTo
    {
        return $this->belongsTo(Capsule::class, 'capsule_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
