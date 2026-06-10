<?php

namespace App\Models;

use App\Casts\CrossDbBoolean;
use App\Models\Concerns\HasCrossDbKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * 时间胶囊。内容与开启时间一经创建即不可变；favorite_count 为去规范化计数。
 * open_at/created_at/updated_at 保持跨库存储格式文本（输出时由 Mapper 统一转 ISO-Z）。
 */
class Capsule extends Model
{
    use HasCrossDbKey;

    protected $table = 'capsules';

    protected $fillable = [
        'owner_id', 'code', 'title', 'content', 'open_at',
        'in_plaza', 'favorite_count', 'created_at', 'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'in_plaza' => CrossDbBoolean::class,
            'favorite_count' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function favorites(): HasMany
    {
        return $this->hasMany(Favorite::class, 'capsule_id');
    }
}
