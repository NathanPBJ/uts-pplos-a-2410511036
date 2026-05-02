# Sistem Kepegawaian & Absensi — Yayasan Satwa Lestari

> Tugas UTS — Mata Kuliah Pembangunan Perangkat Lunak Berorientasi Service (PPLOS)
> Program Studi Informatika, UPN Veteran Jakarta

---

**Nama:** Nathan Abigail Rahman
**NIM:** 2410511036
**Kelas:** A

---

## Demo Video

[![Demo Video](https://img.youtube.com/vi/KOFXuiQl0m8/0.jpg)](https://youtu.be/KOFXuiQl0m8)

---

## Tentang Proyek

Sistem ini dibuat sebagai UTS untuk mata kuliah PPLOS. Intinya ini adalah aplikasi manajemen kepegawaian berbasis microservices untuk **Yayasan Satwa Lestari**, sebuah yayasan konservasi satwa liar. Fitur utamanya mencakup autentikasi (termasuk Google OAuth), manajemen data pegawai, dan sistem absensi dengan perhitungan poin kehadiran.

Kenapa microservices? Karena memang requirement dari soal, tapi juga memang masuk akal karena tiap domain (auth, pegawai, absensi) bisa scale secara independen. Komunikasi antar service dilakukan lewat REST API internal yang diamankan pakai header secret.

---

## Arsitektur Sistem

```
                        +------------------+
           Client ─────>│   API Gateway    │:8000
                        │  (Node.js/Express)│
                        +--------+---------+
                                 │ routing + JWT validation
              ┌──────────────────┼─────────────────────┐
              │                  │                      │
    +---------▼------+  +--------▼-------+  +----------▼------+
    │  Auth Service  │  │Employee Service│  │Attendance Service│
    │  (Node.js)     │  │ (PHP Laravel)  │  │  (Node.js)       │
    │  :3001         │  │  :8080         │  │  :3003           │
    +--------+-------+  +-------+--------+  +--------+--------+
             │                  │                     │
         +---▼---+          +---▼---+            +----▼---+
         │db-auth│          │db-emp │            │db-atten│
         │ MySQL │          │ MySQL │            │  MySQL │
         +-------+          +-------+            +--------+

       * attendance-service berkomunikasi langsung ke employee-service
         via internal API (tidak lewat gateway)
```

---

## Teknologi

| Komponen | Teknologi |
|---|---|
| API Gateway | Node.js, Express, http-proxy-middleware |
| Auth Service | Node.js, Express, Passport.js, Google OAuth 2.0 |
| Employee Service | PHP 8.3, Laravel 11, firebase/php-jwt |
| Attendance Service | Node.js, Express, dayjs, docx |
| Database | MySQL 8.0 (3 instance terpisah) |
| Containerization | Docker, Docker Compose |
| Auth | JWT (access token 15m, refresh token 7 hari) |

---

## Cara Menjalankan

### Prasyarat
- Docker Desktop sudah terinstall dan running
- Port 8000, 3001, 8080, 3003 tidak sedang dipakai

### Langkah-langkah

**1. Clone repo dan buat file .env**

```bash
git clone <repo-url>
cd uts-pplos-a-2410511036
cp .env.example .env
```

Isi nilai-nilai di `.env`, terutama:
- `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` (minimal 32 karakter)
- `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` (dari Google Cloud Console)
- Password database sesuai kebutuhan

Generate `EMPLOYEE_APP_KEY` untuk Laravel (jalankan sekali):

```bash
docker run --rm php:8.3-cli php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

Salin outputnya ke `.env` di bagian `EMPLOYEE_APP_KEY=`.

**2. Build dan jalankan semua service**

```bash
docker-compose up --build
```

Kalau mau jalan di background:

```bash
docker-compose up --build -d
```

**3. Jalankan seeder data awal (departemen & jabatan)**

Setelah semua service running, jalankan seeder sekali:

```bash
docker exec employee-service php artisan db:seed --no-interaction
```

**4. Set akun admin**

Akun yang didaftar via API defaultnya role `staff`. Untuk akses fitur admin, update role-nya:

```bash
docker exec db-auth mysql -u auth_user -pauth_secret auth_db -e "UPDATE users SET role='admin' WHERE email='emailkamu@example.com';"
```

Lalu login ulang supaya token yang baru sudah berisi role admin.

**5. Cek semua service sudah jalan**

```bash
docker-compose ps
```

Semua service harusnya status `Up`. Database butuh beberapa detik sampai healthy sebelum service lain bisa connect.

**6. Matikan semua**

```bash
docker-compose down
```

Kalau mau hapus data juga (reset database):

```bash
docker-compose down -v
```

---

## Daftar Endpoint

Semua request masuk lewat API Gateway di `http://localhost:8000`.

### Autentikasi (`/api/auth`)

| Method | Endpoint | Keterangan | Auth? |
|---|---|---|---|
| POST | `/api/auth/daftar` | Registrasi akun baru (password min. 1 huruf kapital + 1 angka) | Tidak |
| POST | `/api/auth/masuk` | Login, dapat access & refresh token | Tidak |
| POST | `/api/auth/perbarui-token` | Perbarui access token pakai refresh token | Tidak |
| POST | `/api/auth/keluar` | Logout, token di-blacklist | Ya |
| GET | `/api/auth/profil` | Lihat profil akun sendiri | Ya |
| GET | `/api/auth/oauth/google` | Redirect ke halaman login Google | Tidak |
| GET | `/api/auth/oauth/google/callback` | Callback setelah login Google | Tidak |

### Data Pegawai (`/api/pegawai`, `/api/departemen`, `/api/jabatan`)

| Method | Endpoint | Keterangan | Role |
|---|---|---|---|
| GET | `/api/departemen` | Daftar semua departemen | Admin/Pegawai |
| POST | `/api/departemen` | Tambah departemen baru | Admin |
| PUT | `/api/departemen/{id}` | Edit departemen | Admin |
| DELETE | `/api/departemen/{id}` | Hapus departemen | Admin |
| GET | `/api/jabatan` | Daftar jabatan, bisa filter `?departemen=` | Admin/Pegawai |
| POST | `/api/jabatan` | Tambah jabatan | Admin |
| PUT | `/api/jabatan/{id}` | Edit jabatan | Admin |
| DELETE | `/api/jabatan/{id}` | Hapus jabatan | Admin |
| GET | `/api/pegawai` | Daftar pegawai (paging + filter) | Admin/Pegawai |
| POST | `/api/pegawai` | Tambah pegawai baru | Admin |
| GET | `/api/pegawai/{id}` | Detail pegawai | Admin/Pegawai |
| PUT | `/api/pegawai/{id}` | Edit pegawai | Admin |
| DELETE | `/api/pegawai/{id}` | Hapus pegawai (soft delete) | Admin |
| GET | `/api/pegawai/leaderboard` | Ranking pegawai berdasarkan poin kehadiran | Admin/Pegawai |
| GET | `/api/riwayat-jabatan/pegawai/{id}` | Riwayat jabatan seorang pegawai | Admin/Pegawai |

Query params untuk `/api/pegawai`: `?cari=`, `?departemen=`, `?jabatan=`, `?status=`, `?halaman=`, `?per_halaman=`

> **Catatan:** field `jenis_kelamin` hanya menerima nilai `L` atau `P` (bukan "laki-laki"/"perempuan").

### Absensi (`/api/absensi`, `/api/cuti`, `/api/laporan`)

| Method | Endpoint | Keterangan | Role |
|---|---|---|---|
| POST | `/api/absensi/masuk` | Clock-in absensi | Admin/Pegawai sendiri |
| PATCH | `/api/absensi/pulang` | Clock-out absensi | Admin/Pegawai sendiri |
| POST | `/api/absensi/alpha` | Tandai pegawai alpha | Admin |
| GET | `/api/absensi` | Riwayat absensi (paging + filter) | Admin/Pegawai sendiri |
| GET | `/api/absensi/{id}` | Detail satu record absensi | Admin/Pegawai sendiri |
| POST | `/api/cuti` | Ajukan permohonan cuti | Admin/Pegawai sendiri |
| PATCH | `/api/cuti/{id}/setujui` | Setujui pengajuan cuti | Admin |
| PATCH | `/api/cuti/{id}/tolak` | Tolak pengajuan cuti | Admin |
| DELETE | `/api/cuti/{id}` | Batalkan pengajuan cuti | Admin/Pegawai sendiri |
| GET | `/api/cuti` | Daftar pengajuan cuti | Admin/Pegawai sendiri |
| GET | `/api/laporan/bulanan` | Rekap kehadiran bulanan (JSON) | Admin |
| GET | `/api/laporan/bulanan/export` | Export rekap ke file .docx | Admin |

---

## Fitur Tambahan / Catatan

**Sistem Poin Kehadiran**
Setiap pegawai punya poin kehadiran yang terakumulasi. Hadir tepat waktu +10 poin, telat -5 poin, alpha -20 poin. Poin ini disimpan di tabel pegawai dan bisa dilihat lewat endpoint leaderboard. Tujuannya biar ada semacam gamifikasi sederhana untuk mendorong kehadiran.

**Export Laporan ke .docx**
Rekap absensi bulanan bisa diexport jadi file Word (.docx) yang siap cetak, lengkap dengan tabel berformat dan header berwarna hijau (#2D6A4F). Dibuat pakai library `docx` untuk Node.js.

**NIP Auto-generate**
Waktu admin tambah pegawai baru, NIP otomatis di-generate dengan format `YSL{tahun}{kode_dept}{urutan}`, jadi admin ga perlu input manual.

**Riwayat Jabatan**
Setiap kali jabatan atau departemen pegawai diubah, sistem otomatis menutup riwayat jabatan lama dan membuka yang baru. Jadi bisa dilacak pegawai pernah di posisi mana aja.

**Google OAuth**
Selain login biasa (email + password), bisa login pakai akun Google. Kalau email Google sudah terdaftar di sistem, otomatis di-link ke akun yang ada.

**Rate Limiting**
API Gateway membatasi 60 request per menit per IP untuk mencegah abuse.

---

## Struktur Folder

```
uts-pplos-a-2410511036/
├── docker-compose.yml
├── .env.example
├── gateway/                  ← API Gateway (Node.js)
│   ├── index.js
│   ├── Dockerfile
│   └── package.json
├── docs/
│   ├── laporan-uts.pdf       ← Laporan UTS
│   └── arsitektur.png        ← Diagram arsitektur sistem
├── postman/
│   └── collection.json       ← Koleksi endpoint Postman
└── services/
    ├── auth-service/         ← Autentikasi (Node.js)
    ├── employee-service/     ← Data Kepegawaian (Laravel)
    └── attendance-service/   ← Absensi & Laporan (Node.js)
```

---

## Catatan Pengembangan

Beberapa hal yang perlu diketahui kalau mau lanjutkan project ini:

- Semua response API pakai field `pesan` (bukan `message`) karena requirement dari soal
- Token JWT di-share secret-nya antar service, bukan pakai public/private key. Ini trade-off antara simplisitas dan security — untuk production harusnya pakai RS256
- Employee service (Laravel) tidak pakai Laravel Sanctum atau Passport, tapi verifikasi JWT sendiri pakai `firebase/php-jwt` karena token di-issue dari service lain
- Database setiap service benar-benar terpisah, ga ada join cross-database. Data pegawai (nama, NIP) di-denormalisasi ke tabel attendances supaya laporan tidak bergantung ke service lain
- Field `jenis_kelamin` di endpoint pegawai hanya menerima `L` atau `P`

---

*Dibuat untuk keperluan UTS — semoga nilainya bagus 🙏*
