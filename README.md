# Foto Pelantikan

Aplikasi pemesanan foto sesi pelantikan per kelas dan jurusan, dibangun dengan
Next.js (App Router) + PostgreSQL, siap di-hosting di Vercel.

Versi PHP/MySQL lama tetap tersimpan di branch `legacy-php` untuk perbandingan.

## Fitur

- **Siswa** — daftar akun, pesan paket per kelas, bayar (transfer/cash),
  unggah bukti transfer, unduh kuitansi, lihat status pesanan.
- **Admin** — dashboard, monitor, antrian pembayaran, transaksi offline,
  daftar/filter pesanan, riwayat & penghasilan, ekspor CSV, CRUD pengguna,
  produk, jurusan/kelas, dan pengaturan.
- **Guru** — hanya memantau lewat halaman Monitor (read-only).
- **Fotografer** — hanya mengunggah foto hasil.

## Menjalankan secara lokal

Prasyarat: Node.js 20+, dan PostgreSQL lokal (bisa lewat Docker).

```bash
# 1. Database lokal
docker run -d --name fp-pg -p 55432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=foto_pelantikan postgres:16

# 2. Environment
cp .env.example .env.local
# isi DATABASE_URL dengan:
#   postgresql://postgres:postgres@127.0.0.1:55432/foto_pelantikan
# isi SESSION_SECRET dengan:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Skema + data awal
npm install
npm run db:push
npm run db:seed

# 4. Jalankan
npm run dev
```

Aplikasi memakai `.env.local` yang **tidak** ikut ter-commit (lihat `.gitignore`).

## Menjalankan pengujian

Pengujian memakai Playwright terhadap **build produksi**.

```bash
./jalankan-tes.sh
```

Build produksi dipakai karena mode `next dev` tidak bisa hydrate di lingkungan
terisolasi (koneksi HMR websocket diblokir). Skripnya melakukan build,
menjalankan server di `127.0.0.1:3000`, lalu menjalankan seluruh test.

Untuk development biasa:

```bash
npm run dev
npm run typecheck
npm run lint
```

## Akun bawaan

`npm run db:seed` membuat akun berikut. Password semuanya `123456789` —
**ganti sebelum dipakai di produksi.**

| Peran        | Email / username | Halaman awal   |
| ------------ | ---------------- | -------------- |
| Admin        | `admin1`         | `/dashboard`   |
| Guru         | `guru1`          | `/monitor`     |
| Fotografer   | `fotografer1`    | `/upload-foto` |
| Siswa contoh | `siswa1`         | `/pesan`       |

## Deploy ke Vercel

### 1. Database (Neon)

1. Buat project di <https://console.neon.tech>.
2. Salin connection string (yang berawalan `postgresql://`).
3. Pasang di Vercel → **Settings → Environment Variables** → `DATABASE_URL`.
4. Dorong skemanya dari lokal, arahkan `.env.local` ke database Neon, lalu
   jalankan `npm run db:push` dan `npm run db:seed`.

### 2. Rahasia aplikasi

Tambahkan environment variable berikut di Vercel:

| Nama                    | Keterangan                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`          | Connection string Neon                                                |
| `SESSION_SECRET`        | Hex acak ≥ 32 karakter. Generate dengan perintah di `.env.example`.   |
| `BLOB_READ_WRITE_TOKEN` | Token Vercel Blob (dibuat otomatis saat Blob di-connect).             |
| `GOOGLE_CLIENT_ID`      | Opsional. Kosongkan untuk menyembunyikan tombol login Google.         |
| `GOOGLE_CLIENT_SECRET`  | Opsional.                                                              |

`SESSION_SECRET` wajib diganti sebelum deploy. Jangan pernah commit nilai ini.

### 3. Penyimpanan foto (Vercel Blob)

Foto hasil (maks 15 MB) dan bukti transfer (maks 2 MB) disimpan di
**Vercel Blob dengan akses private** dan hanya bisa dibaca lewat route
`/api/foto/[id]` serta `/api/bukti/[id]`, yang keduanya memeriksa kepemilikan
dan peran sebelum mengalirkan berkas.

Batas request Vercel Functions hanya 4,5 MB, jadi berkas **tidak pernah
melewati server**: browser mengunggah langsung ke Blob, lalu pathname-nya
divalidasi ulang di server (ukuran + magic bytes) sebelum disimpan.

Di Vercel: **Storage → Create Blob Store**, lalu hubungkan ke project.

### 4. Login Google (opsional)

1. Buat OAuth Client ID di Google Cloud Console.
2. Tambahkan Redirect URI: `https://DOMAINMU/api/auth/google/callback`.
3. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.

Kalau kedua env itu kosong, tombol "Masuk dengan Google" otomatis disembunyikan
— persis seperti versi PHP.

### 5. Instalasi pertama (opsional)

Kalau database sudah diisi lewat `db:seed`, lewati bagian ini.

Untuk database kosong, buka `https://DOMAINMU/setup` dan buat admin pertama.
Halaman tersebut **mengunci diri sendiri** begitu admin pertama ada, jadi
tidak perlu dihapus manual dari server seperti `setup.php` di versi PHP.

Bila `SETUP_KEY` diisi di environment, kode itu juga wajib dimasukkan saat
membuat admin — ini mencegah orang lain membuat admin duluan di server yang
baru online.

### 6. Deploy

```bash
vercel --prod
```

## Catatan keamanan

Aturan yang dijaga di kode dan diuji otomatis:

- Guru/fotografer tidak dapat mengubah atau menghapus pesanan siswa.
- Bukti transfer hanya terlihat oleh pemiliknya dan admin.
- Pesanan yang dibatalkan tidak bisa dibayar atau dihidupkan kembali.
- Pesanan yang belum lunas tidak bisa berstatus `selesai`.
- Isi dan total pesanan terkunci setelah lunas atau bukti dikirim.
- Nomor antrian terbit sekali dan tidak pernah dipakai ulang.
- Ekspor CSV hanya untuk admin, dan nilai yang diawali `= + - @` diberi
  awalan `' ` agar tidak jadi formula di Excel.
- Session memakai cookie HMAC; isi sesi disimpan di database sehingga tetap
  valid lintas instance serverless.
- Halaman `/setup` terkunci permanen setelah admin pertama dibuat.
- Redirect OAuth memakai host dari request (`X-Forwarded-Host`), bukan URL
  internal Next, supaya redirect URI cocok dengan yang didaftarkan di Google.

## Struktur penting

```
src/app/(admin)/      halaman dashboard, antrian, pesanan, transaksi,
                      riwayat, monitor, upload-foto, arsip, pengguna,
                      produk, jurusan, pengaturan, transaksi/[id]
src/app/(auth)/       masuk, daftar, setup admin pertama
src/app/(siswa)/      pesan, pesanan-saya, pembayaran, kuitansi
src/app/api/          ekspor CSV, bukti/foto (berkas privat), unggah, OAuth Google
src/lib/auth/         sesi, RBAC, CSRF, rate limit, password
src/lib/orders.ts     seluruh logika bisnis pesanan
src/lib/blob.ts       Vercel Blob + validasi magic bytes
public/sw.js          service worker (hanya meng-cache aset statis)
```