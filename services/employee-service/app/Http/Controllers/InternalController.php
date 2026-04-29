<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * InternalController — hanya dipanggil oleh service lain dalam jaringan Docker.
 * Autentikasi menggunakan shared secret di header X-Internal-Secret,
 * bukan JWT (karena tidak melewati API Gateway).
 */
class InternalController extends Controller
{
    // GET /api/internal/pegawai/{id}
    // Dipanggil attendance-service untuk ambil data pegawai sebelum catat absensi
    public function getPegawai(Request $request, int $id): JsonResponse
    {
        if (!$this->secretValid($request)) {
            return $this->error('Akses tidak diizinkan. Internal secret tidak valid.', 403);
        }

        $pegawai = Employee::with(['department:id,kode,nama', 'position:id,kode,nama'])->find($id);

        if (!$pegawai) {
            return $this->error('Pegawai tidak ditemukan.', 404);
        }

        if ($pegawai->status !== 'aktif') {
            return $this->error("Pegawai {$pegawai->nama} berstatus {$pegawai->status} dan tidak dapat melakukan absensi.", 403);
        }

        return $this->sukses('Data pegawai berhasil dimuat.', [
            'id'             => $pegawai->id,
            'nip'            => $pegawai->nip,
            'nama'           => $pegawai->nama,
            'email'          => $pegawai->email,
            'foto_profil'    => $pegawai->foto_url,
            'status'         => $pegawai->status,
            'poin_kehadiran' => $pegawai->poin_kehadiran,
            'departemen'     => $pegawai->department
                ? ['id' => $pegawai->department->id, 'kode' => $pegawai->department->kode, 'nama' => $pegawai->department->nama]
                : null,
            'jabatan'        => $pegawai->position
                ? ['id' => $pegawai->position->id, 'kode' => $pegawai->position->kode, 'nama' => $pegawai->position->nama]
                : null,
        ]);
    }

    // PATCH /api/internal/pegawai/{id}/poin
    // Dipanggil attendance-service setiap kali absensi dicatat/diubah
    // Body: { "delta": 10 } atau { "delta": -5 } atau { "delta": -20 }
    public function updatePoin(Request $request, int $id): JsonResponse
    {
        if (!$this->secretValid($request)) {
            return $this->error('Akses tidak diizinkan. Internal secret tidak valid.', 403);
        }

        $pegawai = Employee::find($id);

        if (!$pegawai) {
            return $this->error('Pegawai tidak ditemukan.', 404);
        }

        $data = $request->validate([
            'delta' => 'required|integer|between:-100,100',
        ], [
            'delta.required' => 'Nilai delta poin wajib diisi.',
            'delta.integer'  => 'Delta poin harus berupa angka bulat.',
            'delta.between'  => 'Delta poin harus antara -100 dan 100.',
        ]);

        $poinLama = $pegawai->poin_kehadiran;

        // Poin boleh negatif — menunjukkan pegawai sering alpha
        $pegawai->increment('poin_kehadiran', $data['delta']);
        $poinBaru = $pegawai->fresh()->poin_kehadiran;

        $arah = $data['delta'] > 0 ? 'bertambah' : 'berkurang';

        return $this->sukses(
            "Poin kehadiran {$pegawai->nama} {$arah} {$data['delta']} poin.",
            [
                'id'             => $pegawai->id,
                'nip'            => $pegawai->nip,
                'nama'           => $pegawai->nama,
                'poin_sebelumnya'=> $poinLama,
                'delta'          => $data['delta'],
                'poin_sekarang'  => $poinBaru,
            ]
        );
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function secretValid(Request $request): bool
    {
        $secret = config('services.attendance_service.secret', '');

        // Jika secret belum dikonfigurasi, tolak semua request untuk keamanan
        if (empty($secret)) {
            return false;
        }

        return $request->header('X-Internal-Secret') === $secret;
    }
}
