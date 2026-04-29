<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDocument extends Model
{
    protected $fillable = [
        'employee_id',
        'jenis_dokumen',
        'nama_dokumen',
        'file_url',
        'tanggal_terbit',
        'tanggal_kadaluarsa',
        'keterangan',
    ];

    protected $casts = [
        'tanggal_terbit'      => 'date',
        'tanggal_kadaluarsa'  => 'date',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    // Cek apakah dokumen sudah/hampir kadaluarsa
    public function getStatusDokumenAttribute(): string
    {
        if (!$this->tanggal_kadaluarsa) return 'berlaku';
        if ($this->tanggal_kadaluarsa->isPast()) return 'kadaluarsa';
        if ($this->tanggal_kadaluarsa->diffInDays(now()) <= 30) return 'segera_kadaluarsa';
        return 'berlaku';
    }
}
