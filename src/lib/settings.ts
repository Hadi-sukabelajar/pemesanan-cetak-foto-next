import 'server-only';
import { getDb } from '@/lib/db';
import { pengaturan } from '@/lib/db/schema';

/**
 * Baca nilai pengaturan (nama sekolah, rekening transfer, dll).
 *
 * Di PHP ada cache statis per request; di sini cukup satu query kecil
 * yang dipakai sekali per render. Nilai yang belum diatur dikembalikan
 * sebagai string kosong supaya pemanggil bisa memakai nilai bawaan.
 */
export async function pengaturanMap(): Promise<Record<string, string>> {
  try {
    const baris = await getDb()
      .select({ kunci: pengaturan.kunci, nilai: pengaturan.nilai })
      .from(pengaturan);
    const hasil: Record<string, string> = {};
    for (const b of baris) hasil[b.kunci] = b.nilai ?? '';
    return hasil;
  } catch {
    return {};
  }
}

/** Nama sekolah; dipakai di header, footer, dan kuitansi. */
export const BADAN_NAMA = 'SMKN 2 SUBANG';

export function namaSekolah(p: Record<string, string>): string {
  return p.nama_sekolah || BADAN_NAMA;
}

export function judulAcara(p: Record<string, string>): string {
  return p.judul_acara || 'Sesi Foto Pelantikan';
}

/** Simpan beberapa pengaturan sekaligus. */
export async function simpanPengaturan(data: Record<string, string>): Promise<void> {
  const db = getDb();
  for (const [kunci, nilai] of Object.entries(data)) {
    await db
      .insert(pengaturan)
      .values({ kunci, nilai })
      .onConflictDoUpdate({ target: pengaturan.kunci, set: { nilai } });
  }
}
