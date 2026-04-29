<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')
                  ->constrained('employees')
                  ->cascadeOnDelete();
            $table->enum('jenis_dokumen', [
                'ktp',
                'npwp',
                'kontrak_kerja',
                'ijazah',
                'sk_pengangkatan',
                'sertifikat',
                'lainnya',
            ])->comment('Jenis dokumen kepegawaian');
            $table->string('nama_dokumen', 200);
            $table->text('file_url');
            $table->date('tanggal_terbit')->nullable();
            $table->date('tanggal_kadaluarsa')->nullable()
                  ->comment('Null = tidak ada masa berlaku');
            $table->text('keterangan')->nullable();
            $table->timestamps();

            $table->index('employee_id');
            $table->index('jenis_dokumen');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_documents');
    }
};
