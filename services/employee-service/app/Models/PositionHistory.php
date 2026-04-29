<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PositionHistory extends Model
{
    protected $fillable = [
        'employee_id',
        'department_id',
        'position_id',
        'tanggal_mulai',
        'tanggal_selesai',
        'keterangan',
        'dibuat_oleh',
    ];

    protected $casts = [
        'tanggal_mulai'   => 'date',
        'tanggal_selesai' => 'date',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function getAktifAttribute(): bool
    {
        return $this->tanggal_selesai === null;
    }
}
