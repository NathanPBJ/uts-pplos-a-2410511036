<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'nip',
        'nama',
        'email',
        'telepon',
        'alamat',
        'jenis_kelamin',
        'tanggal_lahir',
        'tanggal_masuk',
        'department_id',
        'position_id',
        'status',
        'foto_url',
        'poin_kehadiran',
    ];

    protected $casts = [
        'tanggal_lahir'   => 'date',
        'tanggal_masuk'   => 'date',
        'poin_kehadiran'  => 'integer',
    ];

    protected $hidden = [];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function positionHistories(): HasMany
    {
        return $this->hasMany(PositionHistory::class)->orderByDesc('tanggal_mulai');
    }

    // Riwayat jabatan yang masih aktif (tanggal_selesai = null)
    public function jabatanAktif(): HasMany
    {
        return $this->hasMany(PositionHistory::class)->whereNull('tanggal_selesai');
    }
}
