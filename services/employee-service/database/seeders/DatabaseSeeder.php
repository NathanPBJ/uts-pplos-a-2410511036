<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Urutan penting: jabatan bergantung pada departemen (FK)
        $this->call([
            DepartemenSeeder::class,
            JabatanSeeder::class,
        ]);
    }
}
