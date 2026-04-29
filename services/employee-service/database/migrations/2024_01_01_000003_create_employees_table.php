<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('nip', 20)->unique()->comment('Nomor Induk Pegawai');
            $table->string('nama', 150);
            $table->string('email', 255)->unique();
            $table->string('telepon', 20)->nullable();
            $table->text('alamat')->nullable();
            $table->enum('jenis_kelamin', ['L', 'P'])->comment('L = Laki-laki, P = Perempuan');
            $table->date('tanggal_lahir')->nullable();
            $table->date('tanggal_masuk')->comment('Tanggal mulai bekerja di Yayasan Satwa Lestari');
            $table->foreignId('department_id')
                  ->constrained('departments')
                  ->restrictOnDelete();
            $table->foreignId('position_id')
                  ->constrained('positions')
                  ->restrictOnDelete();
            $table->enum('status', ['aktif', 'nonaktif', 'cuti'])->default('aktif');
            $table->text('foto_url')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('department_id');
            $table->index('position_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
