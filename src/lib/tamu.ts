/**
 * Izin akses pesanan tanpa login (pemesan tamu).
 *
 * Alurnya:
 *  1. Pemesan membuat pesanan tanpa akun. Pesanan itu mendapat token acak.
 *  2. Kuitansi langsung dibuka lewat tautan yang membawa ?t=<token>.
 *  3. Sekaligus token disimpan ke sesi, jadi berikutnya tidak perlu ?t=
 *     lagi — mengurangi risiko token bocor lewat riwayat browser, log
 *     server, atau tangkapan layar.
 *  4. Kalau pemesan lupa, ia kembali lewat /cek (kode pesanan + nomor HP).
 *     Setelah cocok, token disimpan ke sesinya seperti pada langkah 3.
 *
 * Menyimpan "izin" di sesi (bukan hanya membandingkan token setiap kali)
 * juga membuat halaman kuitansi bisa di-cache per-pengguna dengan aman:
 * isi cache tidak pernah bocor ke permintaan lain.
 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { getSesi, updateSesi } from '@/lib/auth/session';
import { normalTelepon } from '@/lib/telepon';
import { pesananMilikTamu } from '@/lib/pesanan-akses';

/** Batas jumlah izin yang disimpan per sesi, supaya tidak tumbuh terus. */
const MAKS_TAMU = 20;

/** Token yang tersimpan di sesi untuk sebuah pesanan (atau null). */
export async function tokenTersimpan(idPesanan: number): Promise<string | null> {
  const { data } = await getSesi();
  return data.tamu?.[String(idPesanan)] ?? null;
}

/** Catat bahwa sesi ini boleh membuka pesanan tersebut. */
export async function simpanIzinTamu(idPesanan: number, token: string): Promise<void> {
  await updateSesi((d) => {
    const lama = d.tamu ?? {};
    const baru: Record<string, string> = { ...lama, [String(idPesanan)]: token };

    // Buang yang paling lama kalau kebanyakan.
    const kunci = Object.keys(baru);
    if (kunci.length > MAKS_TAMU) {
      for (const k of kunci.slice(0, kunci.length - MAKS_TAMU)) delete baru[k];
    }
    return { ...d, tamu: baru };
  });
}

/** Buang izin (mis. setelah pesanan dihapus admin). */
export async function buangIzinTamu(idPesanan: number): Promise<void> {
  await updateSesi((d) => {
    if (!d.tamu?.[String(idPesanan)]) return d;
    const { [String(idPesanan)]: _buang, ...sisa } = d.tamu;
    return { ...d, tamu: sisa };
  });
}

/**
 * Cari pesanan lewat kode pesanan + nomor HP — sama persis dengan yang
 * dilakukan pemesan saat memesan tanpa login.
 *
 * Nomor HP dibandingkan dalam bentuk ternormalisasi, jadi "0812-3456"
 * tetap cocok dengan "628123456".
 */
export async function cariPesananTamu(
  kode: string,
  telepon: string,
): Promise<{ id: number; token: string } | null> {
  const kodeBersih = kode.trim().toUpperCase();
  const tel = normalTelepon(telepon);
  if (kodeBersih === '' || tel === '') return null;

  const [p] = await getDb()
    .select({ id: pesanan.id, token: pesanan.token, telepon: pesanan.telepon })
    .from(pesanan)
    .where(eq(pesanan.kode, kodeBersih))
    .limit(1);

  if (!p) return null;

  // Nomor HP sudah ternormalisasi saat pesanan dibuat, tapi dinormalisasi
  // ulang di sini supaya perbandingan tidak bergantung pada format yang
  // dipakai pemesan sekarang.
  if (!p.telepon || normalTelepon(p.telepon) !== tel) return null;

  // Pesanan tanpa token (mis. dibuat sebelum fitur ini ada) tidak bisa
  // dibuka lewat /cek — lebih baik menolak daripada membuka akses
  // tanpa bukti ownership.
  if (!p.token) return null;

  return { id: p.id, token: p.token };
}
/**
 * Apakah pemohon (tanpa akun) boleh mengunggah bukti transfer untuk sebuah
 * pesanan — yaitu apakah ia memegang token pesanan itu di sesinya.
 *
 * Dipakai oleh /api/unggah-token dan /api/unggah-simpan supaya pemesan tanpa
 * akun tetap bisa mengirim bukti, tanpa membuka akses ke pesanan lain.
 */
export async function bolehUnggahBuktiTamu(idPesanan: unknown): Promise<boolean> {
  const id = typeof idPesanan === 'string' ? Number(idPesanan) : idPesanan;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return false;

  const token = await tokenTersimpan(id);
  if (!token) return false;

  return (await pesananMilikTamu(id, token)) !== null;
}
