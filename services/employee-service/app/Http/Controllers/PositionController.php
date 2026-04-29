<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    // GET /api/jabatan?departemen=1
    public function index(Request $request): JsonResponse
    {
        $query = Position::with('department')->withCount('employees');

        if ($request->filled('departemen')) {
            $query->where('department_id', $request->integer('departemen'));
        }

        $jabatan = $query->orderBy('department_id')->orderBy('level')->orderBy('nama')
            ->get()
            ->map(fn($j) => $this->format($j));

        return $this->sukses('Data jabatan berhasil dimuat.', $jabatan);
    }

    // GET /api/jabatan/{id}
    public function show(int $id): JsonResponse
    {
        $jabatan = Position::with('department')->withCount('employees')->find($id);

        if (!$jabatan) {
            return $this->error('Jabatan tidak ditemukan.', 404);
        }

        return $this->sukses('Data jabatan berhasil dimuat.', $this->format($jabatan, detail: true));
    }

    // POST /api/jabatan
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'kode'          => 'required|string|max:10|unique:positions,kode',
            'nama'          => 'required|string|max:100',
            'department_id' => 'nullable|integer|exists:departments,id',
            'level'         => 'required|integer|min:1|max:5',
            'deskripsi'     => 'nullable|string',
        ], $this->pesanValidasi());

        $jabatan = Position::create($data);
        $jabatan->load('department');

        return $this->suksesDibuat('Jabatan baru berhasil ditambahkan.', $this->format($jabatan));
    }

    // PUT /api/jabatan/{id}
    public function update(Request $request, int $id): JsonResponse
    {
        $jabatan = Position::find($id);

        if (!$jabatan) {
            return $this->error('Jabatan tidak ditemukan.', 404);
        }

        $data = $request->validate([
            'kode'          => "required|string|max:10|unique:positions,kode,{$id}",
            'nama'          => 'required|string|max:100',
            'department_id' => 'nullable|integer|exists:departments,id',
            'level'         => 'required|integer|min:1|max:5',
            'deskripsi'     => 'nullable|string',
        ], $this->pesanValidasi());

        $jabatan->update($data);

        return $this->sukses(
            'Data jabatan berhasil diperbarui.',
            $this->format($jabatan->fresh('department'))
        );
    }

    // DELETE /api/jabatan/{id}
    public function destroy(int $id): JsonResponse
    {
        $jabatan = Position::withCount('employees')->find($id);

        if (!$jabatan) {
            return $this->error('Jabatan tidak ditemukan.', 404);
        }

        if ($jabatan->employees_count > 0) {
            return $this->error(
                "Jabatan tidak dapat dihapus karena masih dipegang oleh {$jabatan->employees_count} pegawai.",
                409
            );
        }

        $jabatan->delete();

        return $this->sukses('Jabatan berhasil dihapus.');
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function format(Position $j, bool $detail = false): array
    {
        $data = [
            'id'             => $j->id,
            'kode'           => $j->kode,
            'nama'           => $j->nama,
            'level'          => $j->level,
            'departemen'     => $j->department
                ? ['id' => $j->department->id, 'kode' => $j->department->kode, 'nama' => $j->department->nama]
                : null,
            'jumlah_pegawai' => $j->employees_count ?? 0,
        ];

        if ($detail) {
            $data['deskripsi']       = $j->deskripsi;
            $data['dibuat_pada']     = $j->created_at?->toDateTimeString();
            $data['diperbarui_pada'] = $j->updated_at?->toDateTimeString();
        }

        return $data;
    }

    private function pesanValidasi(): array
    {
        return [
            'kode.required'          => 'Kode jabatan wajib diisi.',
            'kode.max'               => 'Kode jabatan maksimal 10 karakter.',
            'kode.unique'            => 'Kode jabatan sudah digunakan.',
            'nama.required'          => 'Nama jabatan wajib diisi.',
            'nama.max'               => 'Nama jabatan maksimal 100 karakter.',
            'department_id.exists'   => 'Departemen yang dipilih tidak ditemukan.',
            'level.required'         => 'Level jabatan wajib diisi.',
            'level.integer'          => 'Level jabatan harus berupa angka.',
            'level.min'              => 'Level jabatan minimal 1.',
            'level.max'              => 'Level jabatan maksimal 5.',
        ];
    }
}
