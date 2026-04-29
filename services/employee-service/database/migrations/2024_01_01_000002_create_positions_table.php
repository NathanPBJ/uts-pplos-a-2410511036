<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->string('kode', 10)->unique()->comment('Kode unik jabatan, contoh: JAB-01');
            $table->string('nama', 100);
            $table->foreignId('department_id')
                  ->nullable()
                  ->constrained('departments')
                  ->nullOnDelete();
            $table->unsignedTinyInteger('level')->default(1)
                  ->comment('Level hierarki jabatan: 1 = staf, 2 = koordinator, 3 = kepala');
            $table->text('deskripsi')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
