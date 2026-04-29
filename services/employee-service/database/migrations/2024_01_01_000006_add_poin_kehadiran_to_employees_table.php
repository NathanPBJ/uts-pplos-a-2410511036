<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->integer('poin_kehadiran')->default(0)
                  ->after('foto_url')
                  ->comment('Akumulasi poin kehadiran: tepat waktu +10, telat -5, alpha -20');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn('poin_kehadiran');
        });
    }
};
