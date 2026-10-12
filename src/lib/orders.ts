/**
 * Logika bisnis pesanan — terjemahan includes/orders.php.
 *
 * Semua aturan yang diperbaiki di versi PHP harus dipertahankan di sini:
 *  - Nomor antrian tidak pernah dipakai ulang (sudah tercetak di kuitansi).
 *  - Isi pesanan terkunci setelah lunas / setelah bukti transfer dikirim.
 *  - Pesanan dibatalkan tidak bisa dibayar/dihidupkan.
 *  - Item produk yang dinonaktifkan tidak hilang diam-diam.
 */
import 'server-only';
import { and, asc, eq, inArray, max, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  pengaturan,
  pesanan,
  pesananItem,
  produk,
  kelas,
  jurusan,
  type Pesanan,
  type Produk,
} from '@/lib/db/schema';
import type { Tx } from '@/lib/db';

// ----------------------------------------------------------------
// Status & label
// ----------------------------------------------------------------

export const STATUS_BAYAR_LABEL: Record<string, [string, string]> = {
  belum: ['Belum bayar', 'warn'],
  menunggu_verifikasi: ['Menunggu verifikasi', 'info'],
  sudah: ['Lunas', 'ok'],
};

export const STATUS_PESANAN_LABEL: Record<string, [string, string]> = {
  menunggu: ['Menunggu', 'muted'],
  diproses: ['Diproses', 'info'],
  siap_cetak: ['Siap cetak', 'accent'],
  selesai: ['Selesai', 'ok'],
  dibatalkan: ['Dibatalkan', 'bad'],
};

export const METODE_LABEL: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
};

// ----------------------------------------------------------------
// Produk
// ----------------------------------------------------------------

export async function produkAktif(): Promise<Produk[]> {
  return getDb().select().from(produk).where(eq(produk.aktif, true)).orderBy(asc(produk.urutan), asc(produk.id));
}

export async function semuaProduk(): Promise<Produk[]> {
  return getDb().select().from(produk).orderBy(asc(produk.urutan), asc(produk.id));
}

/**
 * Foto contoh produk (public/img/contoh/).
 * Dicocokkan dari nama produk; null kalau tidak ada.
 */
export function fotoProduk(p: { nama: string }): string | null {
  const n = p.nama.toLowerCase();
  let f: string | null = null;
  if (n.includes('bingkai') || n.includes('figura')) f = 'bingkai.jpg';
  else if (n.includes('blok')) f = 'blok.jpg';
  else if (n.includes('a4') || n.includes('cetak')) f = 'a4.jpg';
  return f ? `/img/contoh/${f}` : null;
}

/**
 * Produk yang boleh ditampilkan di form pemesanan.
 *
 * Untuk mode edit, produk yang sudah dinonaktifkan TETAP ikut ditampilkan
 * (dengan penanda nonaktif) selama masih ada di pesanan itu. Kalau tidak,
 * begitu siswa mengedit sedikit saja, item lamanya lenyap diam-diam beserta
 * turunnya total — padahal pesanannya mungkin sudah dibayar sebagian.
 */
export async function produkUntukForm(
  { adminMode = false, editId = 0 }: { adminMode?: boolean; editId?: number } = {},
): Promise<Array<Produk & { nonaktif: boolean }>> {
  const db = getDb();
  const dasar = adminMode
    ? await db.select().from(produk).orderBy(asc(produk.urutan), asc(produk.id))
    : await db.select().from(produk).where(eq(produk.aktif, true)).orderBy(asc(produk.urutan), asc(produk.id));

  const sudahAda = new Set(dasar.map((p) => p.id));
  const lama = editId ? await itemPesanan(editId) : [];
  const kurang = lama
    .map((it) => it.produkId)
    .filter((id): id is number => id !== null && !sudahAda.has(id));

  if (kurang.length === 0) {
    return dasar.map((p) => ({ ...p, nonaktif: adminMode && !p.aktif }));
  }

  const tambahan = await db.select().from(produk).where(inArray(produk.id, [...new Set(kurang)]));
  return [
    ...dasar.map((p) => ({ ...p, nonaktif: adminMode && !p.aktif })),
    ...tambahan.map((p) => ({ ...p, nonaktif: true })),
  ];
}

export async function semuaJurusan() {
  return getDb().select().from(jurusan).orderBy(asc(jurusan.nama));
}

export async function semuaKelas() {
  return getDb().select().from(kelas).orderBy(asc(kelas.nama));
}

// ----------------------------------------------------------------
// Nomor antrian
// ----------------------------------------------------------------

export const KUNCI_ANTRIAN = 'no_antrian_terakhir';

/**
 * Nomor antrian berikutnya — WAJIB dipanggil di dalam transaksi.
 *
 * Di versi PHP pakai MAX(no_antrian)+1 dari baris yang masih ada, sehingga
 * nomor yang sudah tercetak di kuitansi bisa dipakai ulang setelah pesanan
 * dihapus. Sekarang penghitung disimpan permanen di tabel `pengaturan` dan
 * dikunci dengan SELECT ... FOR UPDATE supaya dua admin yang menekan tombol
 * bersamaan tidak mendapat nomor sama.
 */
export async function nomorAntrianBerikutnya(tx: Tx): Promise<number> {
  // Pastikan barisnya ada, lalu kunci baris itu untuk transaksi ini.
  await tx
    .insert(pengaturan)
    .values({ kunci: KUNCI_ANTRIAN, nilai: '0' })
    .onConflictDoNothing();

  const [baris] = await tx
    .select({ nilai: pengaturan.nilai })
    .from(pengaturan)
    .where(eq(pengaturan.kunci, KUNCI_ANTRIAN))
    .for('update');

  const tersimpan = Number(baris?.nilai ?? 0);
  const [maksTabel] = await tx
    .select({ v: max(pesanan.noAntrian) })
    .from(pesanan);

  const berikutnya = Math.max(Number.isFinite(tersimpan) ? tersimpan : 0, Number(maksTabel?.v ?? 0)) + 1;
  await tx
    .update(pengaturan)
    .set({ nilai: String(berikutnya) })
    .where(eq(pengaturan.kunci, KUNCI_ANTRIAN));

  return berikutnya;
}

/** Nomor yang sudah pernah terbit (untuk ditampilkan di Monitor/Antrian). */
export async function nomorAntrianTerakhir(): Promise<number> {
  const db = getDb();
  const [p] = await db
    .select({ nilai: pengaturan.nilai })
    .from(pengaturan)
    .where(eq(pengaturan.kunci, KUNCI_ANTRIAN))
    .limit(1);
  const [m] = await db.select({ v: max(pesanan.noAntrian) }).from(pesanan);
  return Math.max(Number(p?.nilai ?? 0), Number(m?.v ?? 0));
}

// ----------------------------------------------------------------
// Item pesanan
// ----------------------------------------------------------------

export async function itemPesanan(pesananId: number) {
  return getDb().select().from(pesananItem).where(eq(pesananItem.pesananId, pesananId)).orderBy(asc(pesananItem.id));
}

// ----------------------------------------------------------------
// Validasi & penyimpanan pesanan
// ----------------------------------------------------------------

export type HasilValidasi =
  | { ok: true; data: DataPesanan }
  | { ok: false; errors: string[] };

export type DataPesanan = {
  nama: string;
  kelasId: number;
  catatan: string | null;
  qty: Map<number, number>;
};

/**
 * Validasi form pesanan.
 *
 * `editId` dipakai supaya produk yang sudah nonaktif tapi masih ada di
 * pesanan lama tetap ikut dipertimbangkan — kalau tidak, item tersebut
 * hilang diam-diam begitu siswa mengedit pesanan.
 */
export async function validasiPesanan(
  formData: FormData,
  { adminMode = false, editId = 0 }: { adminMode?: boolean; editId?: number } = {},
): Promise<HasilValidasi> {
  const errors: string[] = [];
  const db = getDb();

  const nama = String(formData.get('nama') ?? '').trim();
  const kelasId = Number(formData.get('kelas_id') ?? 0) || 0;
  const catatan = String(formData.get('catatan') ?? '').trim();

  if (nama === '' || Array.from(nama).length > 100) {
    errors.push('Nama wajib diisi (maks. 100 karakter).');
  }
  const kelasAda = await db
    .select({ id: kelas.id })
    .from(kelas)
    .where(eq(kelas.id, kelasId))
    .limit(1);
  if (!kelasAda.length) {
    errors.push('Pilih kelas / jurusan.');
  }
  if (Array.from(catatan).length > 255) {
    errors.push('Catatan maksimal 255 karakter.');
  }

  // Daftar produk yang boleh dipilih. Untuk edit, produk nonaktif yang masih
  // dipakai pesanan ikut supaya item lamanya tidak hilang diam-diam.
  const daftar = await produkUntukForm({ adminMode, editId });

  // Jumlah lama per produk, dipakai untuk mempertahankan item nonaktif
  // yang tidak ikut dikirim formulir (karena tidak ada input-nya).
  const qtyLama = new Map<number, number>();
  if (editId) {
    for (const it of await itemPesanan(editId)) {
      if (it.produkId) qtyLama.set(it.produkId, it.qty);
    }
  }

  const qty = new Map<number, number>();
  for (const p of daftar) {
    const mentah = formData.get(`qty[${p.id}]`);
    const ada = typeof mentah === 'string' && mentah.trim() !== '';
    let n = ada ? Math.trunc(Number(mentah)) : 0;

    // Produk nonaktif: kalau pemesan tidak mengubahnya, jumlah lama dibawa.
    if (!ada && p.nonaktif) {
      n = qtyLama.get(p.id) ?? 0;
    }

    if (!Number.isFinite(n) || n < 0 || n > 50) {
      errors.push(`Jumlah "${p.nama}" harus 0 - 50.`);
      continue;
    }
    if (n > 0) qty.set(p.id, n);
  }
  if (qty.size === 0) {
    errors.push('Pilih minimal satu jenis pesanan (jumlah lebih dari 0).');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      nama,
      kelasId,
      catatan: catatan === '' ? null : catatan,
      qty,
    },
  };
}

/** Buat kode pesanan unik; 3 byte acak + percobaan ulang. */
async function kodeUnik(tx: Tx, dipakai: Set<string>): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const kode = `FP-${stampAwal()}-${acak(6)}`;
    if (dipakai.has(kode)) continue;
    const [ada] = await tx
      .select({ id: pesanan.id })
      .from(pesanan)
      .where(eq(pesanan.kode, kode))
      .limit(1);
    if (!ada) return kode;
  }
  throw new Error('Gagal membuat kode pesanan. Silakan coba lagi.');
}

function stampAwal(): string {
  // yymmdd dalam zona Jakarta
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function acak(n: number): string {
  const huruf = '0123456789ABCDEF';
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => huruf[b % 16]).join('');
}

/**
 * Simpan pesanan baru atau perbarui yang lama.
 * Harga SELALU diambil ulang dari tabel produk, tidak pernah dari browser.
 */
export async function simpanPesanan(
  data: DataPesanan,
  penggunaId: number | null,
  idAda: number | null,
): Promise<number> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [barisKelas] = await tx
      .select({ nama: kelas.nama })
      .from(kelas)
      .where(eq(kelas.id, data.kelasId))
      .limit(1);
    if (!barisKelas) {
      throw new Error('Kelas/jurusan tidak ditemukan. Muat ulang halaman.');
    }
    const namaKelas = barisKelas.nama;

    // Hitung total dari harga di server.
    const ids = [...data.qty.keys()];
    const daftar = ids.length
      ? await tx.select().from(produk).where(inArray(produk.id, ids))
      : [];
    const items: Array<{ produkId: number; nama: string; harga: number; qty: number }> = [];
    let total = 0;
    for (const p of daftar) {
      const n = data.qty.get(p.id) ?? 0;
      if (n <= 0) continue;
      items.push({ produkId: p.id, nama: p.nama, harga: p.harga, qty: n });
      total += p.harga * n;
    }

    if (idAda === null) {
      const noAntrian = await nomorAntrianBerikutnya(tx);
      const dipakai = new Set<string>();
      const kode = await kodeUnik(tx, dipakai);
      const [baru] = await tx
        .insert(pesanan)
        .values({
          kode,
          penggunaId,
          nama: data.nama,
          kelasId: data.kelasId,
          kelasNama: namaKelas,
          catatan: data.catatan,
          total,
          noAntrian,
        })
        .returning({ id: pesanan.id });
      await tx.insert(pesananItem).values(
        items.map((it) => ({
          pesananId: baru.id,
          produkId: it.produkId,
          namaProduk: it.nama,
          harga: it.harga,
          qty: it.qty,
        })),
      );
      return baru.id;
    }

    // --- Perbarui pesanan lama ---
    const [lama] = await tx
      .select({ statusBayar: pesanan.statusBayar })
      .from(pesanan)
      .where(eq(pesanan.id, idAda))
      .for('update')
      .limit(1);

    // Pesanan yang sudah lunas tidak boleh diubah isinya: uang yang sudah
    // masuk tidak lagi sama dengan tagihan. Yang boleh diubah hanya data
    // pemesan (nama/kelas/catatan).
    if (lama?.statusBayar !== 'sudah') {
      await tx.update(pesanan).set({ total }).where(eq(pesanan.id, idAda));
      await tx.delete(pesananItem).where(eq(pesananItem.pesananId, idAda));
      if (items.length) {
        await tx.insert(pesananItem).values(
          items.map((it) => ({
            pesananId: idAda,
            produkId: it.produkId,
            namaProduk: it.nama,
            harga: it.harga,
            qty: it.qty,
          })),
        );
      }
    }
    await tx
      .update(pesanan)
      .set({ nama: data.nama, kelasId: data.kelasId, kelasNama: namaKelas, catatan: data.catatan })
      .where(eq(pesanan.id, idAda));
    return idAda;
  });
}

// ----------------------------------------------------------------
// Pembayaran
// ----------------------------------------------------------------

/**
 * Tandai lunas.
 * Nomor antrian sudah terbit sejak pesanan dibuat; data lama yang belum punya
 * akan mendapat nomor baru di sini.
 */
export async function konfirmasiBayar(
  id: number,
  metode: 'cash' | 'transfer' | null,
): Promise<{ ok: boolean; pesan?: string }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pesanan).where(eq(pesanan.id, id)).for('update').limit(1);
    if (!p) return { ok: false, pesan: 'Pesanan tidak ditemukan.' };
    if (p.status === 'dibatalkan') {
      return { ok: false, pesan: 'Pesanan sudah dibatalkan, tidak bisa dikonfirmasi lunas.' };
    }

    const no = p.noAntrian ?? (await nomorAntrianBerikutnya(tx));
    const m = metode ?? ((p.metode as 'cash' | 'transfer') ?? 'cash');
    const status = p.status === 'menunggu' ? 'diproses' : p.status;

    await tx
      .update(pesanan)
      .set({
        statusBayar: 'sudah',
        metode: m,
        noAntrian: no,
        status,
        dibayarPada: p.dibayarPada ?? new Date(),
      })
      .where(eq(pesanan.id, id));
    return { ok: true };
  });
}

/**
 * Tolak bukti transfer.
 * Tidak menyentuh pesanan yang sudah lunas: UPDATE-nya jadi 0 baris tapi
 * file buktinya tetap ikut terhapus kalau dihapus lebih dulu (bug PHP lama).
 */
export async function tolakBukti(id: number): Promise<{ ok: boolean; pesan?: string }> {
  const db = getDb();
  const [p] = await db.select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
  if (!p) return { ok: false, pesan: 'Pesanan tidak ditemukan.' };
  if (p.statusBayar === 'sudah') {
    return { ok: false, pesan: 'Pesanan sudah lunas, bukti tidak bisa ditolak.' };
  }
  await db
    .update(pesanan)
    .set({ statusBayar: 'belum', buktiTransfer: null, metode: null })
    .where(and(eq(pesanan.id, id), sql`${pesanan.statusBayar} <> 'sudah'`));
  return { ok: true };
}

/**
 * Ubah status pesanan.
 * - Yang dibatalkan tidak boleh dihidupkan lagi (bypass proteksi di jalur bayar).
 * - "Selesai" hanya untuk pesanan yang benar-benar lunas, supaya pesanan
 *   yang belum dibayar tidak masuk ke Riwayat & Penghasilan.
 */
export async function ubahStatus(
  id: number,
  status: string,
): Promise<{ ok: boolean; pesan?: string }> {
  if (!(status in STATUS_PESANAN_LABEL)) {
    return { ok: false, pesan: 'Status tidak dikenal.' };
  }
  const db = getDb();
  const [p] = await db.select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
  if (!p) return { ok: false, pesan: 'Pesanan tidak ditemukan.' };

  if (p.status === 'dibatalkan') {
    return { ok: false, pesan: 'Pesanan sudah dibatalkan, status tidak bisa diubah.' };
  }
  if (status === 'selesai' && p.statusBayar !== 'sudah') {
    return { ok: false, pesan: 'Pesanan belum lunas, tidak bisa ditandai Selesai.' };
  }
  await db.update(pesanan).set({ status: status as Pesanan['status'] }).where(eq(pesanan.id, id));
  return { ok: true };
}

export async function setNamaFile(id: number, namaFile: string | null): Promise<void> {
  await getDb().update(pesanan).set({ namaFile }).where(eq(pesanan.id, id));
}

/** Hapus pesanan (file di Vercel Blob dihapus terpisah oleh pemanggil). */
export async function hapusPesanan(id: number): Promise<void> {
  await getDb().delete(pesanan).where(eq(pesanan.id, id));
}