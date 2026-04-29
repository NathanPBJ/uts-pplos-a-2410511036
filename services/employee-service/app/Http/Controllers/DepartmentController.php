<?php

namespace App\Http\Controllers;

use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    // GET /api/departemen
    public function index(): JsonResponse
    {
        $departemen = Department::withCount('employees')
            ->orderBy('kode')
            ->get()
            ->map(fn($d) => $this->format($d));

        return $this->sukses('Data departemen berhasil dimuat.', $departemen);
    }

    // GET /api/departemen/{id}
    public function show(int $id): JsonResponse
    {
        $dept = Department::withCount('employees')->find($id);

        if (!$dept) {
            return $this->error('Departemen tidak ditemukan.', 404);
        }

        return $this->sukses('Data departemen berhasil dimuat.', $this->format($dept, detail: true));
    }

    // POST /api/departemen
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kode'      => 'required|string|max:10|unique:departments,kode',
            'nama'      => 'required|string|max:100',
            'deskripsi' => 'nullable|string',
        ], $this->pesanValidasi());

        $dept = Department::create($data);

        return $this->suksesDibuat(
            'Departemen baru berhasil ditambahkan.',
            $this->format($dept)
        );
    }

    // PUT /api/departemen/{id}
    public function update(Request $request, int $id): JsonResponse
    {
        $dept = Department::find($id);

        if (!$dept) {
            return $this->error('Departemen tidak ditemukan.', 404);
        }

        $data = $request->validate([
            'kode'      => "required|string|max:10|unique:departments,kode,{$id}",
            'nama'      => 'required|string|max:100',
            'deskripsi' => 'nullable|string',
        ], $this->pesanValidasi());

        $dept->update($data);

        return $this->sukses('Data departemen berhasil diperbarui.', $this->format($dept->fresh()));
    }

    // DELETE /api/departemen/{id}
    public function destroy(int $id): JsonResponse
    {
        $dept = Department::withCount('employees')->find($id);

        if (!$dept) {
            return $this->error('Departemen tidak ditemukan.', 404);
        }

        if ($dept->employees_count > 0) {
            return $this->error(
                "Departemen tidak dapat dihapus karena masih memiliki {$dept->employees_count} pegawai aktif.",
                409
            );
        }

        $dept->delete();

        return $this->sukses('Departemen berhasil dihapus.');
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function format(Department $d, bool $detail = false): array
    {
        $data = [
            'id'             => $d->id,
            'kode'           => $d->kode,
            'nama'           => $d->nama,
            'jumlah_pegawai' => $d->employees_count ?? 0,
            'dibuat_pada'    => $d->created_at?->toDateTimeString(),
        ];

        if ($detail) {
            $data['deskripsi']       = $d->deskripsi;
            $data['diperbarui_pada'] = $d->updated_at?->toDateTimeString();
        }

        return $data;
    }

    private function pesanValidasi(): array
    {
        return [
            'kode.required'   => 'Kode departemen wajib diisi.',
            'kode.max'        => 'Kode departemen maksimal 10 karakter.',
            'kode.unique'     => 'Kode departemen sudah digunakan.',
            'nama.required'   => 'Nama departemen wajib diisi.',
            'nama.max'        => 'Nama departemen maksimal 100 karakter.',
        ];
    }
}
