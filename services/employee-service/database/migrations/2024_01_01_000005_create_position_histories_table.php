<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('position_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')
                  ->constrained('employees')
                  ->cascadeOnDelete();
            $table->foreignId('department_id')
                  ->constrained('departments')
                  ->restrictOnDelete();
            $table->foreignId('position_id')
                  ->constrained('positions')
                  ->restrictOnDelete();
            $table->date('tanggal_mulai');
            $table->date('tanggal_selesai')->nullable()
                  ->comment('Null = jabatan yang masih aktif saat ini');
            $table->text('keterangan')->nullable()
                  ->comment('Alasan mutasi, promosi, atau perubahan jabatan');
            $table->string('dibuat_oleh', 150)->nullable()
                  ->comment('Nama admin yang mencatat perubahan jabatan');
            $table->timestamps();

            $table->index('employee_id');
            $table->index(['employee_id', 'tanggal_selesai']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('position_histories');
    }
};
