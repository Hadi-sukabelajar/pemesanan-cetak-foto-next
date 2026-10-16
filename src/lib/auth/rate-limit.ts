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
import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { percobaanLogin } from '@/lib/db/schema';

const MAKS = 5; // jumlah percobaan gagal
const JEDA_MS = 15 * 60 * 1000; // 15 menit

function kunci(ip: string, email: string): string {
  // Disimpan hash-nya, bukan email/IP aslinya.
  return createHash('sha256').update(`${ip}|${email.toLowerCase()}`).digest('hex');
}

export async function ipPeminat(): Promise<string> {
  // Di App Router IP klien datang lewat header forward, bukan env.
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for') ?? '';
    const pertama = fwd.split(',')[0]?.trim();
    if (pertama) return pertama.slice(0, 45);
    const real = h.get('x-real-ip')?.trim();
    if (real) return real.slice(0, 45);
  } catch {
    // di luar request (tes/cron) — jatuh ke bawah
  }
  return process.env.VERCEL_FORWARDED_FOR?.split(',')[0]?.trim() || 'unknown';
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