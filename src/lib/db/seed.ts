/**
 * Isi database dengan data awal: jurusan, kelas, produk, pengaturan,
 * dan akun bawaan. Sama persis dengan database/database.sql versi PHP.
 *
 * Jalankan: npm run db:seed   (butuh DATABASE_URL di .env.local)
 *
 * Aman dijalankan berulang kali: data yang sudah ada dilewati.
 */
import { sql } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { getDb } from './index';
import { pengaturan, produk, jurusan, kelas, pengguna } from './schema';

const JURUSAN = [
  'RPL', 'TSM', 'TPM', 'TLOG', 'DBP', 'ULP', 'KULINER',
  'TITL', 'TAB', 'APHP', 'ATPH', 'ATU', 'APAT', 'NKN', 'TKN', 'NKPI',
];

// [namaJurusan, ...daftarKelas]
const DAFTAR_KELAS: Array<[string, string[]]> = [
  ['RPL', ['X RPL A', 'X RPL B']],
  ['TSM', ['X TSM A', 'X TSM B', 'X TSM C']],
  ['TPM', ['X TPM A', 'X TPM B', 'X TPM C']],
  ['TLOG', ['X TLOG A', 'X TLOG B', 'X TLOG C']],
  ['DBP', ['X DBP']],
  ['ULP', ['X ULP']],
  ['KULINER', ['X KULINER']],
  ['TITL', ['X TITL']],
  ['TAB', ['X TAB A', 'X TAB B', 'X TAB C']],
  ['APHP', ['X APHP']],
  ['ATPH', ['X ATPH A', 'X ATPH B', 'X ATPH C']],
  ['ATU', ['X ATU']],
  ['APAT', ['X APAT']],
  ['NKN', ['X NKN A', 'X NKN B']],
  ['TKN', ['X TKN']],
  ['NKPI', ['X NKPI']],
];

const PRODUK = [
  { nama: 'Cetak Foto A4', keterangan: 'Cetak foto ukuran A4 tanpa bingkai', harga: 50000, urutan: 1 },
  { nama: 'Bingkai (Figura)', keterangan: 'Cetak foto + bingkai / figura', harga: 80000, urutan: 2 },
  { nama: 'Blok', keterangan: 'Cetak foto di atas blok kayu', harga: 125000, urutan: 3 },
];

const PENGATURAN: Record<string, string> = {
  nama_sekolah: 'SMKN 2 Subang',
  judul_acara: 'Sesi Foto Pelantikan',
  info_transfer: 'Bank BRI 1234-5678-9012 a.n. Panitia Foto Pelantikan',
  info_cash: 'Bayar tunai langsung ke panitia di meja pendaftaran.',
  kontak: '08xx-xxxx-xxxx (Panitia)',
};

/** Password всех akun bawaan. */
const PASSWORD_BAWAAN = '123456789';

async function main() {
  const db = getDb();

  // ---------- Jurusan ----------
  process.stdout.write('Jurusan ... ');
  const baruJurusan = await db
    .insert(jurusan)
    .values(JURUSAN.map((nama) => ({ nama })))
    .onConflictDoNothing({ target: jurusan.nama })
    .returning({ id: jurusan.id });
  const semuaJurusan = await db
    .select({ id: jurusan.id, nama: jurusan.nama })
    .from(jurusan);
  const idJurusan = new Map(semuaJurusan.map((r) => [r.nama, r.id]));
  console.log(`${baruJurusan.length} baru, total ${semuaJurusan.length}`);

  // ---------- Kelas ----------
  process.stdout.write('Kelas ... ');
  const nilaiKelas = DAFTAR_KELAS.flatMap(([namaJurusan, daftar]) =>
    daftar.map((nama) => {
      const cabang = idJurusan.get(namaJurusan);
      if (!cabang) throw new Error(`Jurusan "${namaJurusan}" tidak ditemukan`);
      return { jurusanId: cabang, nama };
    }),
  );
  const baruKelas = await db
    .insert(kelas)
    .values(nilaiKelas)
    .onConflictDoNothing({ target: kelas.nama })
    .returning({ id: kelas.id });
  const totalKelas = await db.select({ id: kelas.id }).from(kelas);
  console.log(`${baruKelas.length} baru, total ${totalKelas.length}`);

  // ---------- Produk ----------
  process.stdout.write('Produk ... ');
  const produkAda = await db.select({ id: produk.id }).from(produk);
  if (produkAda.length === 0) {
    await db.insert(produk).values(PRODUK);
  }
  const totalProduk = await db.select({ id: produk.id }).from(produk);
  console.log(`total ${totalProduk.length}`);

  // ---------- Pengaturan ----------
  process.stdout.write('Pengaturan ... ');
  await db
    .insert(pengaturan)
    .values(Object.entries(PENGATURAN).map(([kunci, nilai]) => ({ kunci, nilai })))
    .onConflictDoUpdate({ target: pengaturan.kunci, set: { nilai: sql`excluded.nilai` } });
  console.log(`${Object.keys(PENGATURAN).length} setting`);

  // ---------- Akun bawaan ----------
  process.stdout.write('Akun bawaan ... ');
  const hashUmum = hashSync(PASSWORD_BAWAAN, 10);
  const akun = [
    {
      nama: 'Administrator',
      username: null,
      email: 'admin@sekolah.test',
      password: hashSync('admin123', 10),
      peran: 'admin' as const,
    },
    ...['1', '2', '3', '4'].map((n) => ({
      nama: `Admin ${n}`,
      username: `admin${n}`,
      email: `admin${n}@sekolah.test`,
      password: hashUmum,
      peran: 'admin' as const,
    })),
    ...['1', '2', '3'].map((n) => ({
      nama: `Guru ${n}`,
      username: `guru${n}`,
      email: `guru${n}@sekolah.test`,
      password: hashUmum,
      peran: 'guru' as const,
    })),
    {
      nama: 'Fotografer 1',
      username: 'fotografer1',
      email: 'fotografer1@sekolah.test',
      password: hashUmum,
      peran: 'fotografer' as const,
    },
  ];
  const baruAkun = await db
    .insert(pengguna)
    .values(akun)
    .onConflictDoNothing({ target: pengguna.email })
    .returning({ id: pengguna.id });
  console.log(`${baruAkun.length} baru`);

  console.log('\nSelesai. Login bawaan:');
  console.log('  admin1 / admin2 / admin3 / admin4  +  guru1..guru3  +  fotografer1');
  console.log(`  password: ${PASSWORD_BAWAAN}`);
  console.log('  admin@sekolah.test / admin123');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\nGagal:', e instanceof Error ? e.message : e);
    process.exit(1);
  });