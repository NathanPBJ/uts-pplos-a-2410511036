<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\PositionController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\RiwayatJabatanController;
use App\Http\Controllers\InternalController;

/*
|--------------------------------------------------------------------------
| Employee Service — API Routes
| Base prefix: /api  (diatur di bootstrap/app.php)
|--------------------------------------------------------------------------
|
| Semua route terproteksi menggunakan middleware 'jwt.auth' yang
| memverifikasi Bearer token dari auth-service.
|
| Penggunaan role:  middleware('jwt.auth:admin')
|                   middleware('jwt.auth:admin,staff')
|
*/

// ─── Departemen ───────────────────────────────────────────────────────────────
Route::prefix('departemen')->middleware('jwt.auth')->group(function () {
    Route::get('/',        [DepartmentController::class, 'index']);
    Route::get('/{id}',    [DepartmentController::class, 'show'])->whereNumber('id');
    Route::post('/',       [DepartmentController::class, 'store'])->middleware('jwt.auth:admin');
    Route::put('/{id}',    [DepartmentController::class, 'update'])->middleware('jwt.auth:admin')->whereNumber('id');
    Route::delete('/{id}', [DepartmentController::class, 'destroy'])->middleware('jwt.auth:admin')->whereNumber('id');
});

// ─── Jabatan ──────────────────────────────────────────────────────────────────
Route::prefix('jabatan')->middleware('jwt.auth')->group(function () {
    Route::get('/',        [PositionController::class, 'index']);
    Route::get('/{id}',    [PositionController::class, 'show'])->whereNumber('id');
    Route::post('/',       [PositionController::class, 'store'])->middleware('jwt.auth:admin');
    Route::put('/{id}',    [PositionController::class, 'update'])->middleware('jwt.auth:admin')->whereNumber('id');
    Route::delete('/{id}', [PositionController::class, 'destroy'])->middleware('jwt.auth:admin')->whereNumber('id');
});

// ─── Pegawai ──────────────────────────────────────────────────────────────────
Route::prefix('pegawai')->middleware('jwt.auth')->group(function () {
    Route::get('/',                          [EmployeeController::class, 'index']);   // paging + filter
    Route::get('/leaderboard',               [EmployeeController::class, 'leaderboard']);
    Route::get('/{id}',                      [EmployeeController::class, 'show'])->whereNumber('id');
    Route::post('/',                         [EmployeeController::class, 'store'])->middleware('jwt.auth:admin');
    Route::put('/{id}',                      [EmployeeController::class, 'update'])->middleware('jwt.auth:admin')->whereNumber('id');
    Route::delete('/{id}',                   [EmployeeController::class, 'destroy'])->middleware('jwt.auth:admin')->whereNumber('id');
    Route::get('/{id}/riwayat-jabatan',      [RiwayatJabatanController::class, 'indexByPegawai'])->whereNumber('id');
});

// ─── Riwayat Jabatan ──────────────────────────────────────────────────────────
Route::prefix('riwayat-jabatan')->middleware('jwt.auth:admin')->group(function () {
    Route::post('/',       [RiwayatJabatanController::class, 'store']);
    Route::put('/{id}',    [RiwayatJabatanController::class, 'update']);
    Route::delete('/{id}', [RiwayatJabatanController::class, 'destroy']);
});

// ─── Internal (dipanggil attendance-service, tanpa JWT) ───────────────────────
Route::prefix('internal')->group(function () {
    Route::get('/pegawai/{id}',            [InternalController::class, 'getPegawai']);
    Route::patch('/pegawai/{id}/poin',     [InternalController::class, 'updatePoin']);
});
