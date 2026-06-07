<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('CREATE EXTENSION IF NOT EXISTS pgcrypto');
            DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');
        }

        Schema::create('users', function (Blueprint $table) use ($driver) {
            $driver === 'pgsql' ? $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()')) : $table->string('id', 36)->primary();
            $table->string('email', 254)->unique('users_email_uk');
            $table->string('password_hash', 100);
            $table->string('nickname', 20)->unique('users_nickname_uk');
            $table->string('avatar_id', 20);
            $driver === 'pgsql' ? $table->timestampTz('created_at') : $table->text('created_at');
            $driver === 'pgsql' ? $table->timestampTz('updated_at') : $table->text('updated_at');
        });

        Schema::create('capsules', function (Blueprint $table) use ($driver) {
            $driver === 'pgsql' ? $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()')) : $table->string('id', 36)->primary();
            $driver === 'pgsql' ? $table->uuid('owner_id') : $table->string('owner_id', 36);
            $table->char('code', 8)->unique('capsules_code_uk');
            $table->string('title', 60);
            $table->text('content');
            $driver === 'pgsql' ? $table->timestampTz('open_at') : $table->text('open_at');
            $table->boolean('in_plaza')->default(true);
            $table->integer('favorite_count')->default(0);
            $driver === 'pgsql' ? $table->timestampTz('created_at') : $table->text('created_at');
            $driver === 'pgsql' ? $table->timestampTz('updated_at') : $table->text('updated_at');
            $table->foreign('owner_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['in_plaza', 'favorite_count', 'created_at'], 'capsules_plaza_hot_ix');
            $table->index(['in_plaza', 'created_at'], 'capsules_plaza_new_ix');
            $table->index(['in_plaza', 'open_at'], 'capsules_plaza_open_at_ix');
            $table->index(['owner_id', 'created_at'], 'capsules_owner_created_ix');
        });

        Schema::create('favorites', function (Blueprint $table) use ($driver) {
            $driver === 'pgsql' ? $table->uuid('user_id') : $table->string('user_id', 36);
            $driver === 'pgsql' ? $table->uuid('capsule_id') : $table->string('capsule_id', 36);
            $driver === 'pgsql' ? $table->timestampTz('created_at') : $table->text('created_at');
            $table->primary(['user_id', 'capsule_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('capsule_id')->references('id')->on('capsules')->cascadeOnDelete();
            $table->index(['user_id', 'created_at'], 'favorites_user_created_ix');
            $table->index('capsule_id', 'favorites_capsule_ix');
        });

        Schema::create('refresh_tokens', function (Blueprint $table) use ($driver) {
            $driver === 'pgsql' ? $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()')) : $table->string('id', 36)->primary();
            $driver === 'pgsql' ? $table->uuid('user_id') : $table->string('user_id', 36);
            $table->string('token_hash', 100)->unique('refresh_tokens_hash_uk');
            $driver === 'pgsql' ? $table->uuid('family_id') : $table->string('family_id', 36);
            $driver === 'pgsql' ? $table->timestampTz('expires_at') : $table->text('expires_at');
            $driver === 'pgsql' ? $table->timestampTz('created_at') : $table->text('created_at');
            $driver === 'pgsql' ? $table->timestampTz('revoked_at')->nullable() : $table->text('revoked_at')->nullable();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index('user_id', 'refresh_tokens_user_ix');
            $table->index('family_id', 'refresh_tokens_family_ix');
            $table->index('expires_at', 'refresh_tokens_expires_ix');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('capsules');
        Schema::dropIfExists('users');
    }
};
