<?php

namespace Database\Seeders;

use App\Models\Department;
use Illuminate\Database\Seeder;

class DepartemenSeeder extends Seeder
{
    public function run(): void
    {
        $departemen = [
            [
                'kode'      => 'DEPT-01',
                'nama'      => 'Perawatan Satwa',
                'deskripsi' => 'Bertanggung jawab atas perawatan harian, pemberian pakan, dan kesejahteraan seluruh satwa koleksi Yayasan Satwa Lestari.',
            ],
            [
                'kode'      => 'DEPT-02',
                'nama'      => 'Kesehatan Satwa',
                'deskripsi' => 'Menangani pemeriksaan medis, pengobatan, vaksinasi, dan karantina satwa yang sakit atau baru masuk.',
            ],
            [
                'kode'      => 'DEPT-03',
                'nama'      => 'Konservasi & Penelitian',
                'deskripsi' => 'Melaksanakan program konservasi spesies, penelitian perilaku satwa, dan kerja sama ilmiah dengan lembaga terkait.',
            ],
            [
                'kode'      => 'DEPT-04',
                'nama'      => 'Edukasi Pengunjung',
                'deskripsi' => 'Merancang dan menyampaikan program edukasi lingkungan kepada pengunjung, sekolah, dan komunitas masyarakat.',
            ],
            [
                'kode'      => 'DEPT-05',
                'nama'      => 'Keamanan',
                'deskripsi' => 'Menjaga keamanan area yayasan, satwa, pengunjung, dan aset organisasi selama 24 jam.',
            ],
            [
                'kode'      => 'DEPT-06',
                'nama'      => 'Keuangan & Umum',
                'deskripsi' => 'Mengelola keuangan yayasan, administrasi kepegawaian, pengadaan barang, dan urusan rumah tangga organisasi.',
            ],
        ];

        foreach ($departemen as $data) {
            Department::firstOrCreate(
                ['kode' => $data['kode']],
                $data
            );
        }

        $this->command->info('✔  Seeder departemen selesai — ' . count($departemen) . ' departemen ditambahkan.');
    }
}
