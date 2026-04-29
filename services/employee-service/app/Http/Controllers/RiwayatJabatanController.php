<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\PositionHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RiwayatJabatanController extends Controller
{
    // GET /api/pegawai/{id}/riwayat-jabatan
    public function indexByPegawai(int $id): JsonResponse
    {
        $pegawai = Employee::find($id);

        if (!$pegawai) {
            return $this->error('Pegawai tidak ditemukan.', 404);
        }

        $riwayat = PositionHistory::with(['department:id,kode,nama', 'position:id,kode,nama,level'])
            ->where('employee_id', $id)
            ->orderByDesc('tanggal_mulai')
            ->get()
            ->map(fn($r) => $this->format($r));

        return $this->sukses(
            "Riwayat jabatan {$pegawai->nama} berhasil dimuat. Total: " . $riwayat->count() . ' entri.',
            $riwayat
        );
    }

    // POST /api/riwayat-jabatan
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id'     => 'required|integer|exists:employees,id',
            'department_id'   => 'required|integer|exists:departments,id',
            'position_id'     => 'required|integer|exists:positions,id',
            'tanggal_mulai'   => 'required|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'keterangan'      => 'nullable|string|max:500',
        ], $this->pesanValidasi());

        $riwayat = DB::transaction(function () use ($data, $request) {
            // Jika ini jabatan aktif (tanggal_selesai null), tutup riwayat aktif sebelumnya
            // dan perbarui data pegawai ke jabatan/departemen baru
            if (empty($data['tanggal_selesai'])) {
                PositionHistory::where('employee_id', $data['employee_id'])
                    ->whereNull('tanggal_selesai')
                    ->update(['tanggal_selesai' => $data['tanggal_mulai']]);

                Employee::where('id', $data['employee_id'])->update([
                    'department_id' => $data['department_id'],
                    'position_id'   => $data['position_id'],
                ]);
            }

            $data['dibuat_oleh'] = $request->input('auth_user.name');

            return PositionHistory::create($data);
        });

        return $this->suksesDibuat(
            'Riwayat jabatan berhasil ditambahkan.' .
            (empty($data['tanggal_selesai']) ? ' Data jabatan pegawai telah diperbarui.' : ''),
            $this->format($riwayat->load(['department', 'position', 'employee:id,nip,nama']))
        );
    }

    // PUT /api/riwayat-jabatan/{id}
    public function update(Request $request, int $id): JsonResponse
    {
        $riwayat = PositionHistory::with(['department', 'position'])->find($id);

        if (!$riwayat) {
            return $this->error('Riwayat jabatan tidak ditemukan.', 404);
        }

        $data = $request->validate([
            'department_id'   => 'sometimes|required|integer|exists:departments,id',
            'position_id'     => 'sometimes|required|integer|exists:positions,id',
            'tanggal_mulai'   => 'sometimes|required|date',
            'tanggal_selesai' => 'nullable|date|after_or_equal:tanggal_mulai',
            'keterangan'      => 'nullable|string|max:500',
        ], $this->pesanValidasi());

        $riwayat->update($data);

        return $this->sukses(
            'Riwayat jabatan berhasil diperbarui.',
            $this->format($riwayat->fresh(['department', 'position']))
        );
    }

    // DELETE /api/riwayat-jabatan/{id}
    public function destroy(int $id): JsonResponse
    {
        $riwayat = PositionHistory::find($id);

        if (!$riwayat) {
            return $this->error('Riwayat jabatan tidak ditemukan.', 404);
        }

        // Cegah hapus riwayat yang masih aktif agar data pegawai tidak inkonsisten
        if ($riwayat->aktif) {
            return $this->error(
                'Riwayat jabatan yang sedang aktif tidak dapat dihapus. Tambahkan riwayat baru untuk memindahkan jabatan.',
                409
            );
        }

        $riwayat->delete();

        return $this->sukses('Riwayat jabatan berhasil dihapus.');
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function format(PositionHistory $r): array
    {
        return [
            'id'              => $r->id,
            'pegawai'         => $r->employee
                ? ['id' => $r->employee->id, 'nip' => $r->employee->nip, 'nama' => $r->employee->nama]
                : ['id' => $r->employee_id],
            'departemen'      => $r->department
                ? ['id' => $r->department->id, 'kode' => $r->department->kode, 'nama' => $r->department->nama]
                : null,
            'jabatan'         => $r->position
                ? ['id' => $r->position->id, 'kode' => $r->position->kode, 'nama' => $r->position->nama, 'level' => $r->position->level]
                : null,
            'tanggal_mulai'   => $r->tanggal_mulai?->toDateString(),
            'tanggal_selesai' => $r->tanggal_selesai?->toDateString(),
            'aktif'           => $r->aktif,
            'keterangan'      => $r->keterangan,
            'dibuat_oleh'     => $r->dibuat_oleh,
            'dibuat_pada'     => $r->created_at?->toDateTimeString(),
        ];
    }

    private function pesanValidasi(): array
    {
        return [
            'employee_id.required'       => 'ID pegawai wajib diisi.',
            'employee_id.exists'         => 'Pegawai tidak ditemukan.',
            'department_id.required'     => 'Departemen wajib dipilih.',
            'department_id.exists'       => 'Departemen tidak ditemukan.',
            'position_id.required'       => 'Jabatan wajib dipilih.',
            'position_id.exists'         => 'Jabatan tidak ditemukan.',
            'tanggal_mulai.required'     => 'Tanggal mulai wajib diisi.',
            'tanggal_mulai.date'         => 'Format tanggal mulai tidak valid.',
            'tanggal_selesai.date'       => 'Format tanggal selesai tidak valid.',
            'tanggal_selesai.after_or_equal' => 'Tanggal selesai harus sama dengan atau setelah tanggal mulai.',
            'keterangan.max'             => 'Keterangan maksimal 500 karakter.',
        ];
    }
}
