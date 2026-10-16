import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan, pesananItem, pengguna, kelas } from '@/lib/db/schema';

/**
 * Query untuk halaman admin.
 *
 * SYARAT PENTING: rumus "penghasilan" harus sama persis di Dashboard,
 * Monitor, dan Riwayat & Penghasilan. Di versi PHP dulu Dashboard menghitung
 * pesanan yang sudah dibatalkan sedangkan Riwayat tidak — angkanya berbeda
 * antar halaman. Semua fungsi di sini memakai satu definisi yang sama:
 * pesanan lunas dan TIDAK dibatalkan.
 */
export const LUNAS_AKTIF =
  sql`${pesanan.statusBayar} = 'sudah' AND ${pesanan.status} <> 'dibatalkan'`;

/** Angka untuk kartu statistik Dashboard. */
export async function statistikDashboard() {
  const [s] = await getDb()
    .select({
      total: sql<number>`COUNT(*)::int`,
      belum: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.statusBayar} = 'belum' AND ${pesanan.status} <> 'dibatalkan')::int`,
      verifikasi: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.statusBayar} = 'menunggu_verifikasi' AND ${pesanan.status} <> 'dibatalkan')::int`,
      lunas: sql<number>`COUNT(*) FILTER (WHERE ${LUNAS_AKTIF})::int`,
      siapCetak: sql<number>`COUNT(*) FILTER (WHERE ${LUNAS_AKTIF} AND ${pesanan.status} = 'siap_cetak')::int`,
      pendapatan: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${LUNAS_AKTIF}), 0)::int`,
    })
    .from(pesanan);

  return {
    total: Number(s?.total ?? 0),
    belum: Number(s?.belum ?? 0),
    verifikasi: Number(s?.verifikasi ?? 0),
    lunas: Number(s?.lunas ?? 0),
    siapCetak: Number(s?.siapCetak ?? 0),
    pendapatan: Number(s?.pendapatan ?? 0),
  };
}

/** Angka untuk halaman Monitor (ringkasan paling lengkap). */
export async function statistikMonitor() {
  const [s] = await getDb()
    .select({
      total: sql<number>`COUNT(*)::int`,
      belum: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.statusBayar} = 'belum' AND ${pesanan.status} <> 'dibatalkan')::int`,
      verifikasi: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.statusBayar} = 'menunggu_verifikasi' AND ${pesanan.status} <> 'dibatalkan')::int`,
      lunas: sql<number>`COUNT(*) FILTER (WHERE ${LUNAS_AKTIF})::int`,
      siapCetak: sql<number>`COUNT(*) FILTER (WHERE ${LUNAS_AKTIF} AND ${pesanan.status} = 'siap_cetak')::int`,
      pendapatan: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${LUNAS_AKTIF}), 0)::int`,
      menunggu: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.status} = 'menunggu')::int`,
      diproses: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.status} = 'diproses')::int`,
      selesai: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.status} = 'selesai')::int`,
      dibatalkan: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.status} = 'dibatalkan')::int`,
      uangTunggu: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${pesanan.statusBayar} <> 'sudah' AND ${pesanan.status} <> 'dibatalkan'), 0)::int`,
    })
    .from(pesanan);

  const [jml] = await getDb()
    .select({
      siswa: sql<number>`COUNT(*) FILTER (WHERE ${pengguna.peran} = 'user')::int`,
      admin: sql<number>`COUNT(*) FILTER (WHERE ${pengguna.peran} = 'admin')::int`,
      guru: sql<number>`COUNT(*) FILTER (WHERE ${pengguna.peran} = 'guru')::int`,
    })
    .from(pengguna);

  return {
    total: Number(s?.total ?? 0),
    belum: Number(s?.belum ?? 0),
    verifikasi: Number(s?.verifikasi ?? 0),
    lunas: Number(s?.lunas ?? 0),
    siapCetak: Number(s?.siapCetak ?? 0),
    pendapatan: Number(s?.pendapatan ?? 0),
    menunggu: Number(s?.menunggu ?? 0),
    diproses: Number(s?.diproses ?? 0),
    selesai: Number(s?.selesai ?? 0),
    dibatalkan: Number(s?.dibatalkan ?? 0),
    uangTunggu: Number(s?.uangTunggu ?? 0),
    akunSiswa: Number(jml?.siswa ?? 0),
    akunAdmin: Number(jml?.admin ?? 0),
    akunGuru: Number(jml?.guru ?? 0),
  };
}

/** Ringkasan item pesanan, mis. "Cetak Foto A4 ×2; Bingkai ×1". */
const RINGKAS = sql<string>`(
  SELECT STRING_AGG(${pesananItem.namaProduk} || ' ×' || ${pesananItem.qty}, '; ' ORDER BY ${pesananItem.id})
  FROM ${pesananItem}
  WHERE ${pesananItem.pesananId} = ${pesanan.id}
)`;

export function kolomPesanan() {
  return {
    id: pesanan.id,
    kode: pesanan.kode,
    penggunaId: pesanan.penggunaId,
    nama: pesanan.nama,
    kelasId: pesanan.kelasId,
    kelasNama: pesanan.kelasNama,
    catatan: pesanan.catatan,
    total: pesanan.total,
    metode: pesanan.metode,
    statusBayar: pesanan.statusBayar,
    buktiTransfer: pesanan.buktiTransfer,
    noAntrian: pesanan.noAntrian,
    status: pesanan.status,
    namaFile: pesanan.namaFile,
    fotoHasil: pesanan.fotoHasil,
    dibayarPada: pesanan.dibayarPada,
    dibuatPada: pesanan.dibuatPada,
    diperbaruiPada: pesanan.diperbaruiPada,
  };
}

export type BarisPesanan = { ringkas: string | null } & Record<string, unknown>;

export type Syarat = {
  cari?: string;
  statusBayar?: string;
  status?: string;
  kelasId?: number;
  /** 'semua' | 'pending' | 'proses' | 'lunas' */
  kategori?: string;
  /** Tab upload foto: 'proses' (belum ada foto) | 'sudah' */
  foto?: string;
  /** Arsip: 'siap' (siap cetak) | 'semua' */
  arsip?: string;
  /** Hanya pesanan berstatus selesai. */
  selesai?: boolean;
  /** Rentang tanggal bayar/pesan, format YYYY-MM-DD. */
  dari?: string;
  sampai?: string;
};

/** Susun WHERE dari parameter filter halaman. */
export function syaratPesanan(s: Syarat) {
  const syarat: ReturnType<typeof and>[] = [];

  if (s.cari) {
    // Escape wildcard LIKE supaya "%" / "_" dari input hanya dicari harfiah.
    const aman = s.cari.replace(/[\\%_]/g, (m) => `\\${m}`);
    syarat.push(
      sql`(${pesanan.kode} ILIKE ${`%${aman}%`} ESCAPE '\\' OR ${pesanan.nama} ILIKE ${`%${aman}%`} ESCAPE '\\')`,
    );
  }
  if (s.statusBayar) syarat.push(eq(pesanan.statusBayar, s.statusBayar as never));
  if (s.status) syarat.push(eq(pesanan.status, s.status as never));
  if (typeof s.kelasId === 'number' && Number.isInteger(s.kelasId)) {
    syarat.push(eq(pesanan.kelasId, s.kelasId));
  }

  switch (s.kategori) {
    case 'pending':
      syarat.push(
        sql`${pesanan.status} <> 'dibatalkan' AND ${pesanan.statusBayar} = 'belum' AND ${pesanan.metode} IS NULL`,
      );
      break;
    case 'proses':
      syarat.push(
        sql`${pesanan.status} <> 'dibatalkan' AND ${pesanan.statusBayar} <> 'sudah'
             AND (${pesanan.statusBayar} = 'menunggu_verifikasi' OR ${pesanan.metode} IS NOT NULL)`,
      );
      break;
    case 'lunas':
      syarat.push(LUNAS_AKTIF);
      break;
    case 'semua':
      syarat.push(sql`${pesanan.status} <> 'dibatalkan'`);
      break;
  }

  if (s.foto === 'proses') syarat.push(sql`${pesanan.fotoHasil} IS NULL`);
  if (s.foto === 'sudah') syarat.push(sql`${pesanan.fotoHasil} IS NOT NULL`);
  if (s.arsip === 'siap') syarat.push(eq(pesanan.status, 'siap_cetak'));
  if (s.selesai) {
    syarat.push(sql`${pesanan.status} = 'selesai' AND ${pesanan.statusBayar} = 'sudah'`);
  }

  // Tanggal memakai tanggal bayar, fallback ke tanggal pesanan.
  // Bandingkan sebagai tanggal Jakarta (bukan timestamptz UTC) supaya
  // filter dari/sampai tidak meleset 7 jam di batas hari.
  const tglsql = sql`COALESCE(${pesanan.dibayarPada}, ${pesanan.dibuatPada})`;
  const tglJakarta = sql`(${tglsql} AT TIME ZONE 'Asia/Jakarta')::date`;
  if (s.dari) syarat.push(sql`${tglJakarta} >= ${s.dari}::date`);
  if (s.sampai) {
    // "sampai" berarti sepanjang hari itu juga.
    syarat.push(sql`${tglJakarta} <= ${s.sampai}::date`);
  }

  return and(...syarat);
}

/** Daftar pesanan dengan ringkasan item. */
export async function daftarPesanan(
  syarat: Syarat = {},
  opsi: { ambil?: number; lewati?: number; urut?: 'id' | 'antrian' } = {},
) {
  const ambil = opsi.ambil ?? 300;
  const lewati = opsi.lewati ?? 0;

  const db = getDb();
  const select = { ...kolomPesanan(), ringkas: RINGKAS };

  if (opsi.urut === 'antrian') {
    // Nomor kosong ditaruh paling akhir.
    return db
      .select(select)
      .from(pesanan)
      .where(syaratPesanan(syarat))
      .orderBy(asc(sql`${pesanan.noAntrian} IS NULL`), asc(pesanan.noAntrian), desc(pesanan.id))
      .limit(ambil)
      .offset(lewati);
  }

  return db
    .select(select)
    .from(pesanan)
    .where(syaratPesanan(syarat))
    .orderBy(desc(pesanan.id))
    .limit(ambil)
    .offset(lewati);
}

/** Jumlah baris untuk filter tertentu (paginasi & jumlah di tab). */
export async function hitungPesanan(s: Syarat = {}): Promise<number> {
  const [r] = await getDb()
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(pesanan)
    .where(syaratPesanan(s));
  return Number(r?.n ?? 0);
}

/** Kategori pembayaran sebuah pesanan (untuk tab Antrian). */
export function kategoriBayar(p: {
  statusBayar: string;
  metode: string | null;
}): 'pending' | 'proses' | 'lunas' {
  if (p.statusBayar === 'sudah') return 'lunas';
  if (p.statusBayar === 'menunggu_verifikasi' || p.metode) return 'proses';
  return 'pending';
}

/** Label status pembayaran versi admin (lebih rinci). */
export function labelBayarAdmin(p: { statusBayar: string; metode: string | null }) {
  if (p.statusBayar === 'sudah') return { teks: 'Sudah bayar', warna: 'ok' };
  if (p.statusBayar === 'menunggu_verifikasi') {
    return { teks: 'Proses · cek bukti transfer', warna: 'info' };
  }
  if (p.metode === 'cash') return { teks: 'Proses · menunggu bayar cash', warna: 'info' };
  return { teks: 'Pending · belum bayar', warna: 'warn' };
}

/** Nomor antrian yang sedang dipanggil + nomor terakhir terbit. */
export async function antrianSekarang() {
  const [sekarang] = await getDb()
    .select({
      no: pesanan.noAntrian,
      nama: pesanan.nama,
      kelasNama: pesanan.kelasNama,
    })
    .from(pesanan)
    .where(sql`${pesanan.statusBayar} = 'sudah' AND ${pesanan.status} NOT IN ('selesai','dibatalkan')`)
    .orderBy(sql`${pesanan.noAntrian} ASC NULLS LAST`)
    .limit(1);

  const { nomorAntrianTerakhir } = await import('@/lib/orders');
  return { sekarang: sekarang ?? null, terakhir: await nomorAntrianTerakhir() };
}

/** Omzet per hari (halaman Riwayat & Penghasilan). */
export async function penghasilanPerHari(s: Syarat = {}) {
  const tglsql = sql`COALESCE(${pesanan.dibayarPada}, ${pesanan.dibuatPada})`;
  const hariJakarta = sql`TO_CHAR(${tglsql} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`;
  // Hanya hitung yang lunas & tidak dibatalkan, sama seperti rekap.
  const tambahan = syaratPesanan({
    ...s,
    selesai: false,
    kategori: undefined,
    status: undefined,
    statusBayar: undefined,
  });
  return getDb()
    .select({
      hari: sql<string>`${hariJakarta}`,
      jml: sql<number>`COUNT(*)::int`,
      uang: sql<number>`COALESCE(SUM(${pesanan.total}), 0)::int`,
    })
    .from(pesanan)
    .where(and(LUNAS_AKTIF, tambahan))
    .groupBy(sql`${hariJakarta}`)
    .orderBy(sql`${hariJakarta} DESC`)
    .limit(60);
}

/**
 * Rekap omzet.
 * Memakai LUNAS_AKTIF yang sama dengan Dashboard & Monitor.
 */
export async function rekapPenghasilan(s: Syarat = {}) {
  // Gabung syarat "lunas & tidak dibatalkan" dengan filter tanggal/pencarian.
  const tambahan = syaratPesanan({
    ...s,
    selesai: false,
    kategori: undefined,
    status: undefined,
    statusBayar: undefined,
  });

  const [r] = await getDb()
    .select({
      jml: sql<number>`COUNT(*)::int`,
      uang: sql<number>`COALESCE(SUM(${pesanan.total}), 0)::int`,
      uangSelesai: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${pesanan.status} = 'selesai'), 0)::int`,
      jmlSelesai: sql<number>`COUNT(*) FILTER (WHERE ${pesanan.status} = 'selesai')::int`,
      uangProses: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${pesanan.status} <> 'selesai'), 0)::int`,
      cash: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${pesanan.metode} = 'cash'), 0)::int`,
      transfer: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${pesanan.metode} = 'transfer'), 0)::int`,
    })
    .from(pesanan)
    .where(and(LUNAS_AKTIF, tambahan));

  return {
    jml: Number(r?.jml ?? 0),
    uang: Number(r?.uang ?? 0),
    uangSelesai: Number(r?.uangSelesai ?? 0),
    jmlSelesai: Number(r?.jmlSelesai ?? 0),
    uangProses: Number(r?.uangProses ?? 0),
    cash: Number(r?.cash ?? 0),
    transfer: Number(r?.transfer ?? 0),
  };
}

/** Jumlah pesanan per kelas (Monitor). */
export async function rekapPerKelas() {
  return getDb()
    .select({
      kelas: sql<string>`COALESCE(${pesanan.kelasNama}, '-')`,
      jml: sql<number>`COUNT(*)::int`,
      lunas: sql<number>`COUNT(*) FILTER (WHERE ${LUNAS_AKTIF})::int`,
      uang: sql<number>`COALESCE(SUM(${pesanan.total}) FILTER (WHERE ${LUNAS_AKTIF}), 0)::int`,
    })
    .from(pesanan)
    .where(sql`${pesanan.status} <> 'dibatalkan'`)
    .groupBy(pesanan.kelasNama)
    .orderBy(asc(pesanan.kelasNama));
}

/** Jumlah terjual per produk (Monitor). */
export async function rekapPerProduk() {
  return getDb()
    .select({
      namaProduk: pesananItem.namaProduk,
      qty: sql<number>`COALESCE(SUM(${pesananItem.qty}), 0)::int`,
      nilai: sql<number>`COALESCE(SUM(${pesananItem.qty} * ${pesananItem.harga}), 0)::int`,
    })
    .from(pesananItem)
    .innerJoin(pesanan, eq(pesananItem.pesananId, pesanan.id))
    .where(sql`${pesanan.status} <> 'dibatalkan'`)
    .groupBy(pesananItem.namaProduk)
    .orderBy(desc(sql`COALESCE(SUM(${pesananItem.qty}), 0)`));
}

/** Pengguna terbaru (Monitor, hanya ditampilkan untuk admin). */
export async function penggunaTerbaru(jumlah = 10) {
  return getDb()
    .select({
      id: pengguna.id,
      nama: pengguna.nama,
      email: pengguna.email,
      username: pengguna.username,
      peran: pengguna.peran,
      dibuatPada: pengguna.dibuatPada,
      kelas: kelas.nama,
    })
    .from(pengguna)
    .leftJoin(kelas, eq(pengguna.kelasId, kelas.id))
    .orderBy(desc(pengguna.id))
    .limit(jumlah);
}

/** Jumlah pesanan tiap pengguna. */
export async function jumlahPesananPengguna(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const hasil = await getDb()
    .select({ penggunaId: pesanan.penggunaId, n: sql<number>`COUNT(*)::int` })
    .from(pesanan)
    .where(inArray(pesanan.penggunaId, ids))
    .groupBy(pesanan.penggunaId);
  return new Map(hasil.map((r) => [Number(r.penggunaId), Number(r.n)]));
}