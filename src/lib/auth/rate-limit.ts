/**
 * Pembatas percobaan login.
 *
 * Di PHP versi lama penghitungnya disimpan di $_SESSION, jadi menghapus
 * cookie selalu mengembalikan ke nol dan brute force tidak terbatas.
 * Di sini penghitung disimpan di tabel `percobaan_login` dengan kunci
 * sha1(IP + email) — bertahan lintas request, lintas instance, dan lintas
 * cookie baru.
 */
import 'server-only';
import { eq, lt, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db';
import { percobaanLogin } from '@/lib/db/schema';

const MAKS = 5; // jumlah percobaan gagal
const JEDA_MS = 15 * 60 * 1000; // 15 menit

function kunci(ip: string, email: string): string {
  // Disimpan hash-nya, bukan email/IP aslinya.
  return createHash('sha256').update(`${ip}|${email.toLowerCase()}`).digest('hex');
}

export function ipPeminat(): string {
  // Di Vercel, forwarded-for sudah diisi platform.
  const fwd = process.env.VERCEL_FORWARDED_FOR ?? '';
  return fwd.split(',')[0]?.trim() || process.env.REMOTE_ADDR || 'unknown';
}

function sudahLewatWaktu(terakhir: Date): boolean {
  return Date.now() - terakhir.getTime() > JEDA_MS;
}

/** True kalau sudah terlalu sering gagal (jadi tolak sebelum cek password). */
export async function terlaluBanyakGagal(ip: string, email: string): Promise<boolean> {
  if (!email) return false;
  const db = getDb();
  const [baris] = await db
    .select()
    .from(percobaanLogin)
    .where(eq(percobaanLogin.kunci, kunci(ip, email)))
    .limit(1);

  if (!baris) return false;
  if (sudahLewatWaktu(baris.terakhir)) {
    await db.delete(percobaanLogin).where(eq(percobaanLogin.kunci, kunci(ip, email)));
    return false;
  }
  return baris.jumlah >= MAKS;
}

/** Catat satu kegagalan. */
export async function catatGagal(ip: string, email: string): Promise<void> {
  if (!email) return;
  const db = getDb();
  const k = kunci(ip, email);
  const [baris] = await db
    .select()
    .from(percobaanLogin)
    .where(eq(percobaanLogin.kunci, k))
    .limit(1);

  if (!baris || sudahLewatWaktu(baris.terakhir)) {
    await db
      .insert(percobaanLogin)
      .values({ kunci: k, jumlah: 1, terakhir: new Date() })
      .onConflictDoUpdate({
        target: percobaanLogin.kunci,
        set: { jumlah: 1, terakhir: new Date() },
      });
    return;
  }
  await db
    .update(percobaanLogin)
    .set({ jumlah: sql`${percobaanLogin.jumlah} + 1`, terakhir: new Date() })
    .where(eq(percobaanLogin.kunci, k));
}

/** Bersihkan penghitung setelah login berhasil. */
export async function bersihkanGagal(ip: string, email: string): Promise<void> {
  if (!email) return;
  await getDb().delete(percobaanLogin).where(eq(percobaanLogin.kunci, kunci(ip, email)));
}

/** Hapus catatan yang sudah lewat 15 menit (dipanggil dari instrumentation). */
export async function bersihkanKedaluwarsa(): Promise<void> {
  await getDb()
    .delete(percobaanLogin)
    .where(lt(percobaanLogin.terakhir, new Date(Date.now() - JEDA_MS)));
}

export { MAKS as MAKS_PERCOBAAN };