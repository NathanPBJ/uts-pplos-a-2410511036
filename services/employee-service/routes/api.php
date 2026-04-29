<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Employee Service — API Routes
| Base prefix: /api  (diatur di bootstrap/app.php)
|--------------------------------------------------------------------------
|
| Semua route terproteksi menggunakan middleware 'gateway.auth' yang
| membaca header X-User-* yang diteruskan oleh API Gateway setelah
| validasi JWT.
|
| Endpoint publik (tanpa auth):
|   GET  /health  — health check (diatur otomatis oleh withRouting)
|
*/

// ─── Departemen ───────────────────────────────────────────────────────────────
Route::prefix('departemen')->middleware('gateway.auth')->group(function () {
    Route::get('/',      [\App\Http\Controllers\DepartemenController::class, 'index']);
    Route::post('/',     [\App\Http\Controllers\DepartemenController::class, 'store'])->middleware('gateway.auth:admin');
    Route::get('/{id}',  [\App\Http\Controllers\DepartemenController::class, 'show']);
    Route::put('/{id}',  [\App\Http\Controllers\DepartemenController::class, 'update'])->middleware('gateway.auth:admin');
    Route::delete('/{id}', [\App\Http\Controllers\DepartemenController::class, 'destroy'])->middleware('gateway.auth:admin');
});

// ─── Jabatan ──────────────────────────────────────────────────────────────────
Route::prefix('jabatan')->middleware('gateway.auth')->group(function () {
    Route::get('/',      [\App\Http\Controllers\JabatanController::class, 'index']);
    Route::post('/',     [\App\Http\Controllers\JabatanController::class, 'store'])->middleware('gateway.auth:admin');
    Route::get('/{id}',  [\App\Http\Controllers\JabatanController::class, 'show']);
    Route::put('/{id}',  [\App\Http\Controllers\JabatanController::class, 'update'])->middleware('gateway.auth:admin');
    Route::delete('/{id}', [\App\Http\Controllers\JabatanController::class, 'destroy'])->middleware('gateway.auth:admin');
});

// ─── Pegawai ──────────────────────────────────────────────────────────────────
Route::prefix('pegawai')->middleware('gateway.auth')->group(function () {
    Route::get('/',      [\App\Http\Controllers\PegawaiController::class, 'index']);   // paging + filter
    Route::post('/',     [\App\Http\Controllers\PegawaiController::class, 'store'])->middleware('gateway.auth:admin');
    Route::get('/{id}',  [\App\Http\Controllers\PegawaiController::class, 'show']);
    Route::put('/{id}',  [\App\Http\Controllers\PegawaiController::class, 'update'])->middleware('gateway.auth:admin');
    Route::delete('/{id}', [\App\Http\Controllers\PegawaiController::class, 'destroy'])->middleware('gateway.auth:admin');

    // Riwayat jabatan pegawai tertentu
    Route::get('/{id}/riwayat-jabatan', [\App\Http\Controllers\RiwayatJabatanController::class, 'indexByPegawai']);
});

// ─── Riwayat Jabatan ──────────────────────────────────────────────────────────
Route::prefix('riwayat-jabatan')->middleware('gateway.auth:admin')->group(function () {
    Route::post('/',     [\App\Http\Controllers\RiwayatJabatanController::class, 'store']);
    Route::put('/{id}',  [\App\Http\Controllers\RiwayatJabatanController::class, 'update']);
    Route::delete('/{id}', [\App\Http\Controllers\RiwayatJabatanController::class, 'destroy']);
});

// ─── Inter-Service (dipanggil oleh attendance-service) ────────────────────────
// Tidak melalui gateway auth — pakai shared secret header
Route::prefix('internal')->group(function () {
    Route::get('/pegawai/{id}', [\App\Http\Controllers\InternalController::class, 'getPegawai']);
});
