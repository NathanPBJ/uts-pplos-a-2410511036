<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Position;
use App\Models\PositionHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmployeeController extends Controller
{
    // GET /api/pegawai
    // Query params: cari, departemen, jabatan, status, halaman, per_halaman
    public function index(Request $request): JsonResponse
    {
        $query = Employee::with(['department:id,kode,nama', 'position:id,kode,nama,level'])
            ->select('id', 'nip', 'nama', 'email', 'telepon', 'jenis_kelamin',
                     'status', 'foto_url', 'poin_kehadiran', 'department_id',
                     'position_id', 'tanggal_masuk');

        // ── Filter ───────────────────────────────────────────────────────────
        if ($request->filled('cari')) {
            $kata = $request->string('cari')->trim()->toString();
            $query->where(function ($q) use ($kata) {
                $q->where('nama',  'like', "%{$kata}%")
                  ->orWhere('nip',   'like', "%{$kata}%")
                  ->orWhere('email', 'like', "%{$kata}%");
            });
        }

        if ($request->filled('departemen')) {
            $query->where('department_id', $request->integer('departemen'));
        }

        if ($request->filled('jabatan')) {
            $query->where('position_id', $request->integer('jabatan'));
        }

        if ($request->filled('status')) {
            $request->validate(
                ['status' => 'in:aktif,nonaktif,cuti'],
                ['status.in' => 'Status tidak valid. Pilihan: aktif, nonaktif, cuti.']
            );
            $query->where('status', $request->status);
        }

        // ── Paginasi ──────────────────────────────────────────────────────────
        $perHalaman = min($request->integer('per_halaman', 15), 100);
        $halaman    = max($request->integer('halaman', 1), 1);

        $hasil = $query->orderBy('nama')->paginate($perHalaman, ['*'], 'halaman', $halaman);

        return $this->sukses('Data pegawai berhasil dimuat.', [
            'pegawai'  => $hasil->getCollection()->map(fn($e) => $this->formatRingkas($e)),
            'paginasi' => [
                'halaman_saat_ini'        => $hasil->currentPage(),
                'per_halaman'             => $hasil->perPage(),
                'total'                   => $hasil->total(),
                'total_halaman'           => $hasil->lastPage(),
                'ada_halaman_berikutnya'  => $hasil->hasMorePages(),
            ],
            'filter_aktif' => array_filter([
                'cari'      => $request->cari,
                'departemen'=> $request->departemen,
                'jabatan'   => $request->jabatan,
                'status'    => $request->status,
            ]),
        ]);
    }

    // GET /api/pegawai/leaderboard — peringkat poin kehadiran
    public function leaderboard(Request $request): JsonResponse
    {
        $perHalaman = min($request->integer('per_halaman', 10), 50);
        $halaman    = max($request->integer('halaman', 1), 1);

        $hasil = Employee::with(['department:id,kode,nama', 'position:id,kode,nama'])
            ->where('status', 'aktif')
            ->select('id', 'nip', 'nama', 'foto_url', 'poin_kehadiran', 'department_id', 'position_id')
            ->orderByDesc('poin_kehadiran')
            ->orderBy('nama')
            ->paginate($perHalaman, ['*'], 'halaman', $halaman);

        $offset = ($hasil->currentPage() - 1) * $hasil->perPage();

        return $this->sukses('Leaderboard poin kehadiran berhasil dimuat.', [
            'leaderboard' => $hasil->getCollection()->values()->map(function ($e, $idx) use ($offset) {
                return [
                    'peringkat'      => $offset + $idx + 1,
                    'id'             => $e->id,
                    'nip'            => $e->nip,
                    'nama'           => $e->nama,
                    'foto_profil'    => $e->foto_url,
                    'poin_kehadiran' => $e->poin_kehadiran,
                    'departemen'     => $e->department?->nama,
                    'jabatan'        => $e->position?->nama,
                ];
            }),
            'paginasi' => [
                'halaman_saat_ini' => $hasil->currentPage(),
                'per_halaman'      => $hasil->perPage(),
                'total'            => $hasil->total(),
                'total_halaman'    => $hasil->lastPage(),
            ],
        ]);
    }

    // GET /api/pegawai/{id}
    public function show(int $id): JsonResponse
    {
        $pegawai = Employee::with([
            'department',
            'position.department',
            'documents',
            'positionHistories.department',
            'positionHistories.position',
        ])->find($id);

        if (!$pegawai) {
            return $this->error('Data pegawai tidak ditemukan.', 404);
        }

        return $this->sukses('Data pegawai berhasil dimuat.', $this->formatLengkap($pegawai));
    }

    // POST /api/pegawai
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nip'            => 'nullable|string|max:20|unique:employees,nip',
            'nama'           => 'required|string|max:150',
            'email'          => 'required|email|max:255|unique:employees,email',
            'telepon'        => 'nullable|string|max:20',
            'alamat'         => 'nullable|string',
            'jenis_kelamin'  => 'required|in:L,P',
            'tanggal_lahir'  => 'nullable|date|before:today',
            'tanggal_masuk'  => 'required|date',
            'department_id'  => 'required|integer|exists:departments,id',
            'position_id'    => 'required|integer|exists:positions,id',
            'status'         => 'nullable|in:aktif,nonaktif,cuti',
            'foto_url'       => 'nullable|url|max:2048',
        ], $this->pesanValidasi());

        // Auto-generate NIP jika tidak diberikan: YSL + tahun(2) + kode dept + urutan
        if (empty($data['nip'])) {
            $data['nip'] = $this->generateNip($data['department_id']);
        }

        $data['status']          ??= 'aktif';
        $data['poin_kehadiran']    = 0;

        $pegawai = DB::transaction(function () use ($data, $request) {
            $p = Employee::create($data);

            // Catat riwayat jabatan awal
            PositionHistory::create([
                'employee_id'   => $p->id,
                'department_id' => $p->department_id,
                'position_id'   => $p->position_id,
                'tanggal_mulai' => $p->tanggal_masuk,
                'keterangan'    => 'Penempatan awal saat bergabung.',
                'dibuat_oleh'   => $request->input('auth_user.name'),
            ]);

            return $p;
        });

        return $this->suksesDibuat(
            "Pegawai {$pegawai->nama} berhasil ditambahkan dengan NIP {$pegawai->nip}.",
            $this->formatLengkap($pegawai->fresh(['department', 'position', 'positionHistories']))
        );
    }

    // PUT /api/pegawai/{id}
    public function update(Request $request, int $id): JsonResponse
    {
        $pegawai = Employee::find($id);

        if (!$pegawai) {
            return $this->error('Data pegawai tidak ditemukan.', 404);
        }

        $data = $request->validate([
            'nip'            => "nullable|string|max:20|unique:employees,nip,{$id}",
            'nama'           => 'sometimes|required|string|max:150',
            'email'          => "sometimes|required|email|max:255|unique:employees,email,{$id}",
            'telepon'        => 'nullable|string|max:20',
            'alamat'         => 'nullable|string',
            'jenis_kelamin'  => 'sometimes|required|in:L,P',
            'tanggal_lahir'  => 'nullable|date|before:today',
            'tanggal_masuk'  => 'sometimes|required|date',
            'department_id'  => 'sometimes|required|integer|exists:departments,id',
            'position_id'    => 'sometimes|required|integer|exists:positions,id',
            'status'         => 'nullable|in:aktif,nonaktif,cuti',
            'foto_url'       => 'nullable|url|max:2048',
        ], $this->pesanValidasi());

        $pindahJabatan = isset($data['position_id']) && $data['position_id'] != $pegawai->position_id
                      || isset($data['department_id']) && $data['department_id'] != $pegawai->department_id;

        DB::transaction(function () use ($pegawai, $data, $request, $pindahJabatan) {
            if ($pindahJabatan) {
                // Tutup riwayat jabatan yang sedang aktif
                PositionHistory::where('employee_id', $pegawai->id)
                    ->whereNull('tanggal_selesai')
                    ->update(['tanggal_selesai' => now()->toDateString()]);

                // Buka riwayat jabatan baru
                PositionHistory::create([
                    'employee_id'   => $pegawai->id,
                    'department_id' => $data['department_id'] ?? $pegawai->department_id,
                    'position_id'   => $data['position_id']   ?? $pegawai->position_id,
                    'tanggal_mulai' => now()->toDateString(),
                    'keterangan'    => $request->input('keterangan_mutasi', 'Perubahan jabatan/departemen.'),
                    'dibuat_oleh'   => $request->input('auth_user.name'),
                ]);
            }

            $pegawai->update($data);
        });

        return $this->sukses(
            'Data pegawai berhasil diperbarui.' . ($pindahJabatan ? ' Riwayat jabatan telah dicatat.' : ''),
            $this->formatLengkap($pegawai->fresh(['department', 'position', 'positionHistories']))
        );
    }

    // DELETE /api/pegawai/{id}
    public function destroy(int $id): JsonResponse
    {
        $pegawai = Employee::find($id);

        if (!$pegawai) {
            return $this->error('Data pegawai tidak ditemukan.', 404);
        }

        $nama = $pegawai->nama;
        $pegawai->delete(); // soft delete

        return $this->sukses("Data pegawai {$nama} berhasil diarsipkan.");
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private function generateNip(int $departmentId): string
    {
        $dept    = Department::find($departmentId);
        $deptNum = str_pad(explode('-', $dept->kode)[1] ?? '00', 2, '0', STR_PAD_LEFT);
        $urutan  = Employee::withTrashed()->where('department_id', $departmentId)->count() + 1;

        return 'YSL' . date('y') . $deptNum . str_pad($urutan, 4, '0', STR_PAD_LEFT);
    }

    private function formatRingkas(Employee $e): array
    {
        return [
            'id'             => $e->id,
            'nip'            => $e->nip,
            'nama'           => $e->nama,
            'email'          => $e->email,
            'telepon'        => $e->telepon,
            'jenis_kelamin'  => $e->jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
            'status'         => $e->status,
            'foto_profil'    => $e->foto_url,
            'poin_kehadiran' => $e->poin_kehadiran,
            'tanggal_masuk'  => $e->tanggal_masuk?->toDateString(),
            'departemen'     => $e->department
                ? ['id' => $e->department->id, 'kode' => $e->department->kode, 'nama' => $e->department->nama]
                : null,
            'jabatan'        => $e->position
                ? ['id' => $e->position->id, 'kode' => $e->position->kode, 'nama' => $e->position->nama, 'level' => $e->position->level]
                : null,
        ];
    }

    private function formatLengkap(Employee $e): array
    {
        return array_merge($this->formatRingkas($e), [
            'jenis_kelamin'  => $e->jenis_kelamin, // raw L/P untuk edit form
            'alamat'         => $e->alamat,
            'tanggal_lahir'  => $e->tanggal_lahir?->toDateString(),
            'dokumen'        => $e->documents?->map(fn($d) => [
                'id'                 => $d->id,
                'jenis'              => $d->jenis_dokumen,
                'nama'               => $d->nama_dokumen,
                'file_url'           => $d->file_url,
                'tanggal_terbit'     => $d->tanggal_terbit?->toDateString(),
                'tanggal_kadaluarsa' => $d->tanggal_kadaluarsa?->toDateString(),
                'status_dokumen'     => $d->status_dokumen,
            ]),
            'riwayat_jabatan' => $e->positionHistories?->map(fn($r) => [
                'id'             => $r->id,
                'departemen'     => $r->department?->nama,
                'jabatan'        => $r->position?->nama,
                'tanggal_mulai'  => $r->tanggal_mulai?->toDateString(),
                'tanggal_selesai'=> $r->tanggal_selesai?->toDateString(),
                'aktif'          => $r->aktif,
                'keterangan'     => $r->keterangan,
            ]),
            'dibuat_pada'    => $e->created_at?->toDateTimeString(),
            'diperbarui_pada'=> $e->updated_at?->toDateTimeString(),
        ]);
    }

    private function pesanValidasi(): array
    {
        return [
            'nip.unique'              => 'NIP sudah digunakan oleh pegawai lain.',
            'nip.max'                 => 'NIP maksimal 20 karakter.',
            'nama.required'           => 'Nama pegawai wajib diisi.',
            'nama.max'                => 'Nama pegawai maksimal 150 karakter.',
            'email.required'          => 'Email wajib diisi.',
            'email.email'             => 'Format email tidak valid.',
            'email.unique'            => 'Email sudah terdaftar untuk pegawai lain.',
            'jenis_kelamin.required'  => 'Jenis kelamin wajib dipilih.',
            'jenis_kelamin.in'        => 'Jenis kelamin hanya boleh L (Laki-laki) atau P (Perempuan).',
            'tanggal_lahir.before'    => 'Tanggal lahir harus sebelum hari ini.',
            'tanggal_masuk.required'  => 'Tanggal masuk wajib diisi.',
            'department_id.required'  => 'Departemen wajib dipilih.',
            'department_id.exists'    => 'Departemen yang dipilih tidak ditemukan.',
            'position_id.required'    => 'Jabatan wajib dipilih.',
            'position_id.exists'      => 'Jabatan yang dipilih tidak ditemukan.',
            'status.in'               => 'Status tidak valid. Pilihan: aktif, nonaktif, cuti.',
            'foto_url.url'            => 'Format URL foto tidak valid.',
            'telepon.max'             => 'Nomor telepon maksimal 20 karakter.',
        ];
    }
}
