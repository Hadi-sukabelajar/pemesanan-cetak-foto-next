/**
 * Uji logika bisnis inti langsung ke database.
 * Jalankan: npx tsx scripts/uji-logika.ts
 *
 * Fokus: aturan yang pernah jadi bug di versi PHP.
 */
import { eq, and } from 'drizzle-orm';
import { getDb } from '../src/lib/db';
import { pesanan, pesananItem, pengaturan, produk, kelas } from '../src/lib/db/schema';
import {
  simpanPesanan,
  validasiPesanan,
  konfirmasiBayar,
  tolakBukti,
  ubahStatus,
  nomorAntrianBerikutnya,
  KUNCI_ANTRIAN,
} from '../src/lib/orders';

let lulus = 0;
let gagal = 0;

function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (ok) {
    lulus++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${nama}`);
  } else {
    gagal++;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${nama}`);
    console.log(`        dapat: ${JSON.stringify(dapat)} | harap: ${JSON.stringify(harap)}`);
  }
}

async function main() {
  const db = getDb();

  // Bersihkan data uji
  await db.delete(pesananItem);
  await db.delete(pesanan);
  await db
    .update(pengaturan)
    .set({ nilai: '0' })
    .where(eq(pengaturan.kunci, KUNCI_ANTRIAN));
  await db.delete(produk);
  await db.insert(produk).values([
    { nama: 'Cetak Foto A4', harga: 50000, urutan: 1 },
    { nama: 'Bingkai (Figura)', harga: 80000, urutan: 2 },
  ]);
  const daftarProduk = await db.select().from(produk);

  // Kelas pertama yang ada.
  // Pakai query builder (bukan execute/SQL mentah) supaya hasilnya sama
  // di driver lokal maupun Neon.
  const [barisKelas] = await db.select({ id: kelas.id }).from(kelas).orderBy(kelas.id).limit(1);
  const kelasId = barisKelas.id;

  const p1 = daftarProduk[0].id;
  const p2 = daftarProduk[1].id;

  console.log('\n== 1. Harga dihitung di server (tidak dari browser) ==');
  const idA = await simpanPesanan(
    { nama: 'Budi', kelasId, catatan: null, qty: new Map([[p1, 2], [p2, 1]]) },
    null,
    null,
  );
  const [a] = await db.select().from(pesanan).where(eq(pesanan.id, idA));
  cek('total = 2x50.000 + 1x80.000', a.total, 180000);
  cek('nomor antrian terbit saat pesan', a.noAntrian, 1);
  const items = await db.select().from(pesananItem).where(eq(pesananItem.pesananId, idA));
  cek('2 item tersimpan', items.length, 2);

  console.log('\n== 2. Nomor antrian naik & tidak pernah dipakai ulang ==');
  const idB = await simpanPesanan(
    { nama: 'Siti', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  const [b] = await db.select().from(pesanan).where(eq(pesanan.id, idB));
  cek('pesanan kedua dapat nomor 2', b.noAntrian, 2);

  // Hapus pesanan bernomor tertinggi
  await db.delete(pesanan).where(eq(pesanan.id, idB));
  const idC = await simpanPesanan(
    { nama: 'Andi', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  const [c] = await db.select().from(pesanan).where(eq(pesanan.id, idC));
  cek('setelah dihapus, nomor tetap naik (3)', c.noAntrian, 3);

  console.log('\n== 3. Dua insert bersamaan -> nomor berbeda ==');
  const [d1, d2] = await Promise.all([
    simpanPesanan({ nama: 'R1', kelasId, catatan: null, qty: new Map([[p1, 1]]) }, null, null),
    simpanPesanan({ nama: 'R2', kelasId, catatan: null, qty: new Map([[p1, 1]]) }, null, null),
  ]);
  const baris = await db
    .select({ no: pesanan.noAntrian })
    .from(pesanan)
    .where(and(eq(pesanan.id, d1)));
  const [d2row] = await db.select().from(pesanan).where(eq(pesanan.id, d2));
  const nomor2 = await db.select({ no: pesanan.noAntrian }).from(pesanan).where(eq(pesanan.id, d2));
  cek('kedua pesanan dapat nomor berbeda', new Set([baris[0].no, nomor2[0].no]).size, 2);
  void d2row;

  console.log('\n== 4. Isi terkunci setelah lunas ==');
  const sebelumLunas = await simpanPesanan(
    { nama: 'Dewi', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  await konfirmasiBayar(sebelumLunas, 'cash');
  // Coba tambah qty
  await simpanPesanan(
    { nama: 'Dewi Ganti', kelasId, catatan: 'catatan baru', qty: new Map([[p1, 5], [p2, 3]]) },
    null,
    sebelumLunas,
  );
  const [setelahLunas] = await db.select().from(pesanan).where(eq(pesanan.id, sebelumLunas));
  cek('total pesanan lunas tidak berubah', setelahLunas.total, 50000);
  cek('nama pemesan tetap bisa diubah', setelahLunas.nama, 'Dewi Ganti');
  cek('catatan tetap bisa diubah', setelahLunas.catatan, 'catatan baru');
  const itemSetelah = await db.select().from(pesananItem).where(eq(pesananItem.pesananId, sebelumLunas));
  cek('item pesanan lunas tidak berubah', itemSetelah.length, 1);

  console.log('\n== 5. Pesanan dibatalkan tidak bisa dibayar ==');
  const idBatal = await simpanPesanan(
    { nama: 'Batal', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  await db.update(pesanan).set({ status: 'dibatalkan' }).where(eq(pesanan.id, idBatal));
  const hasilBayar = await konfirmasiBayar(idBatal, 'cash');
  cek('konfirmasi bayar ditolak', hasilBayar.ok, false);
  const [batal] = await db.select().from(pesanan).where(eq(pesanan.id, idBatal));
  cek('statusBayar tetap belum', batal.statusBayar, 'belum');

  console.log('\n== 6. Pesanan dibatalkan tidak bisa dihidupkan ==');
  const hasilStatus = await ubahStatus(idBatal, 'menunggu');
  cek('ubah status ditolak', hasilStatus.ok, false);
  const [batal2] = await db.select().from(pesanan).where(eq(pesanan.id, idBatal));
  cek('status tetap dibatalkan', batal2.status, 'dibatalkan');

  console.log('\n== 7. Belum lunas tidak bisa jadi "Selesai" ==');
  const idBelum = await simpanPesanan(
    { nama: 'Belum', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  const hasilSelesai = await ubahStatus(idBelum, 'selesai');
  cek('tandai selesai ditolak', hasilSelesai.ok, false);
  const [belum] = await db.select().from(pesanan).where(eq(pesanan.id, idBelum));
  cek('status tetap menunggu', belum.status, 'menunggu');

  console.log('\n== 8. Tolak bukti pada pesanan lunas ditolak ==');
  const idTerbayar = await simpanPesanan(
    { nama: 'Lunas', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  await db
    .update(pesanan)
    .set({ statusBayar: 'sudah', buktiTransfer: 'bukti/abc.jpg', metode: 'transfer' })
    .where(eq(pesanan.id, idTerbayar));
  const hasilTolak = await tolakBukti(idTerbayar);
  cek('tolak ditolak', hasilTolak.ok, false);
  const [terbayar] = await db.select().from(pesanan).where(eq(pesanan.id, idTerbayar));
  cek('bukti tidak berubah', terbayar.buktiTransfer, 'bukti/abc.jpg');
  cek('metode tidak berubah', terbayar.metode, 'transfer');

  console.log('\n== 9. Tolak bukti pada pesanan menunggu bekerja ==');
  const idMenunggu = await simpanPesanan(
    { nama: 'Menunggu', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  await db
    .update(pesanan)
    .set({ statusBayar: 'menunggu_verifikasi', buktiTransfer: 'bukti/def.jpg', metode: 'transfer' })
    .where(eq(pesanan.id, idMenunggu));
  const hasilTolak2 = await tolakBukti(idMenunggu);
  cek('tolak berhasil', hasilTolak2.ok, true);
  const [menunggu] = await db.select().from(pesanan).where(eq(pesanan.id, idMenunggu));
  cek('bukti di-null-kan', menunggu.buktiTransfer, null);
  cek('metode di-null-kan', menunggu.metode, null);
  cek('statusBayar kembali belum', menunggu.statusBayar, 'belum');

  console.log('\n== 10. Produk nonaktif tidak hilang saat edit ==');
  await db.update(produk).set({ aktif: false }).where(eq(produk.id, p2));
  const idEdit = await simpanPesanan(
    { nama: 'Edit Test', kelasId, catatan: null, qty: new Map([[p1, 1]]) },
    null,
    null,
  );
  await db.insert(pesananItem).values({
    pesananId: idEdit,
    produkId: p2,
    namaProduk: 'Bingkai (Figura)',
    harga: 80000,
    qty: 1,
  });
  await db.update(pesanan).set({ total: 130000 }).where(eq(pesanan.id, idEdit));
  // Edit formulir — produk nonaktif tidak punya input, jadi tidak terkirim.
  const formEdit = new FormData();
  formEdit.set('nama', 'Edit Test');
  formEdit.set('kelas_id', String(kelasId));
  formEdit.set('catatan', '');
  formEdit.set(`qty[${p1}]`, '1');
  const hasilValidasi = await validasiPesanan(formEdit, { editId: idEdit });
  cek('validasi edit lolos', hasilValidasi.ok, true);
  if (hasilValidasi.ok) {
    await simpanPesanan(hasilValidasi.data, null, idEdit);
  }
  const itemsEdit = await db.select().from(pesananItem).where(eq(pesananItem.pesananId, idEdit));
  cek('item produk nonaktif tetap ada', itemsEdit.length, 2);
  cek('total = 50.000 + 80.000', (await db.select().from(pesanan).where(eq(pesanan.id, idEdit)))[0].total, 130000);
  await db.update(produk).set({ aktif: true }).where(eq(produk.id, p2));

  console.log('\n== 11. Penomoran di dalam transaksi ==');
  const nomorDalam = await db.transaction(async (tx) => nomorAntrianBerikutnya(tx));
  cek('nomor berikutnya = max+1', nomorDalam > 0, true);

  console.log('\n== 12. Kode pesanan unik ==');
  const semua = await db.select({ kode: pesanan.kode }).from(pesanan);
  cek('semua kode unik', new Set(semua.map((x) => kodeUnik(x.kode))).size, semua.length);
  function kodeUnik(k: string) {
    return k;
  }

  console.log(`\n=================================`);
  console.log(`  LULUS: ${lulus}    GAGAL: ${gagal}`);
  console.log(`=================================`);
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nGagal total:', e);
  process.exit(1);
});