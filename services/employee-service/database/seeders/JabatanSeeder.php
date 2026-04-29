<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Position;
use Illuminate\Database\Seeder;

class JabatanSeeder extends Seeder
{
    public function run(): void
    {
        // Ambil ID departemen berdasarkan kode
        $dept = Department::pluck('id', 'kode');

        $jabatan = [
            // ── Perawatan Satwa ───────────────────────────────────────────────
            [
                'kode'          => 'JAB-01',
                'nama'          => 'Penjaga Satwa',
                'department_id' => $dept['DEPT-01'],
                'level'         => 1,
                'deskripsi'     => 'Merawat dan mengawasi satwa sehari-hari, memastikan kandang bersih, pakan tersedia, dan satwa dalam kondisi sehat.',
            ],
            [
                'kode'          => 'JAB-02',
                'nama'          => 'Kepala Kandang',
                'department_id' => $dept['DEPT-01'],
                'level'         => 3,
                'deskripsi'     => 'Memimpin tim penjaga satwa, menyusun jadwal perawatan, dan berkoordinasi dengan departemen kesehatan untuk penanganan satwa.',
            ],

            // ── Kesehatan Satwa ───────────────────────────────────────────────
            [
                'kode'          => 'JAB-03',
                'nama'          => 'Dokter Hewan',
                'department_id' => $dept['DEPT-02'],
                'level'         => 3,
                'deskripsi'     => 'Melakukan pemeriksaan klinis, diagnosis, pengobatan, dan tindakan medis pada satwa koleksi yayasan.',
            ],
            [
                'kode'          => 'JAB-04',
                'nama'          => 'Perawat Hewan',
                'department_id' => $dept['DEPT-02'],
                'level'         => 1,
                'deskripsi'     => 'Membantu dokter hewan dalam tindakan medis, merawat satwa pasca-pengobatan, dan mengelola obat-obatan di klinik satwa.',
            ],

            // ── Konservasi & Penelitian ───────────────────────────────────────
            [
                'kode'          => 'JAB-05',
                'nama'          => 'Peneliti Lapangan',
                'department_id' => $dept['DEPT-03'],
                'level'         => 2,
                'deskripsi'     => 'Melakukan observasi dan pengumpulan data perilaku satwa di lapangan, serta menyusun laporan ilmiah hasil penelitian.',
            ],
            [
                'kode'          => 'JAB-06',
                'nama'          => 'Koordinator Konservasi',
                'department_id' => $dept['DEPT-03'],
                'level'         => 3,
                'deskripsi'     => 'Merancang dan mengkoordinasikan program konservasi spesies, menjalin kerjasama dengan lembaga konservasi nasional dan internasional.',
            ],

            // ── Edukasi Pengunjung ────────────────────────────────────────────
            [
                'kode'          => 'JAB-07',
                'nama'          => 'Pemandu Edukasi',
                'department_id' => $dept['DEPT-04'],
                'level'         => 1,
                'deskripsi'     => 'Memandu kunjungan edukasi, menyampaikan informasi tentang satwa dan konservasi kepada pengunjung dan kelompok pelajar.',
            ],

            // ── Keamanan ─────────────────────────────────────────────────────
            [
                'kode'          => 'JAB-08',
                'nama'          => 'Petugas Keamanan',
                'department_id' => $dept['DEPT-05'],
                'level'         => 1,
                'deskripsi'     => 'Menjaga keamanan dan ketertiban area yayasan, memantau akses masuk-keluar, dan merespons kejadian darurat.',
            ],

            // ── Keuangan & Umum ───────────────────────────────────────────────
            [
                'kode'          => 'JAB-09',
                'nama'          => 'Staf Administrasi',
                'department_id' => $dept['DEPT-06'],
                'level'         => 1,
                'deskripsi'     => 'Mengelola administrasi umum, surat-menyurat, pengarsipan dokumen, dan mendukung kegiatan operasional yayasan.',
            ],
        ];

        foreach ($jabatan as $data) {
            Position::firstOrCreate(
                ['kode' => $data['kode']],
                $data
            );
        }

        $this->command->info('✔  Seeder jabatan selesai — ' . count($jabatan) . ' jabatan ditambahkan.');
    }
}
