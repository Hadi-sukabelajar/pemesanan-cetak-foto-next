/**
 * Sesi pengguna — pengganti $_SESSION PHP.
 *
 * Kenapa tidak pakai session bawaan Next.js?
 * Karena Vercel Functions bisa menjalankan banyak instance sekaligus, dan
 * cookie harus tetap valid lintas instance. Cookie stateless bisa "diisi
 * ulang" (terlihat), jadi cookie ini hanya berisi ID sesi bertanda tangan
 * HMAC; isi sesinya (flash, oauth_state, dll) disimpan di database.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cache } from 'react';
import { eq, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { sesi, pengguna, type Pengguna, type Peran } from '@/lib/db/schema';

const COOKIE = 'fp_sesi';
const MAKA = 1000 * 60 * 60 * 24 * 14; // 14 hari

/** Jenis pesan flash yang dipakai seluruh aplikasi. */
export type JenisFlash = 'ok' | 'bad' | 'warn' | 'info';

/** Data yang disimpan di baris tabel `sesi` (setara $_SESSION PHP). */
export type DataSesi = {
  flash?: Array<{ type: JenisFlash; msg: string }>;
  oauthState?: string;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET belum diisi atau terlalu pendek. Minimal 32 karakter.',
    );
  }
  return s;
}

function sign(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

function unsign(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [id, mac] = parts;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(id));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

function opsiCookie(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}

type IsiSesi = { id: string | null; data: DataSesi; user: Pengguna | null };

/**
 * Baca sesi saat ini.
 *
 * `cache()` dari React dipakai supaya hasil ini dihitung SEKALI per request
 * dan TIDAK dibagikan ke request lain. Ini penting: kalau cache-nya berada di
 * level modul, dua pengguna yang kebetulan requests bersamaan bisa saling
 * membaca sesi masing-masing.
 */
export const getSesi = cache(async (): Promise<IsiSesi> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return { id: null, data: {}, user: null };

  const id = unsign(token);
  if (!id) return { id: null, data: {}, user: null };

  const db = getDb();
  const [baris] = await db.select().from(sesi).where(eq(sesi.id, id)).limit(1);
  if (!baris) return { id: null, data: {}, user: null };
  if (new Date(baris.kedaluwarsa).getTime() < Date.now()) {
    await db.delete(sesi).where(eq(sesi.id, id));
    return { id: null, data: {}, user: null };
  }

  let data: DataSesi = {};
  try {
    data = JSON.parse(baris.data) as DataSesi;
  } catch {
    data = {};
  }

  let user: Pengguna | null = null;
  if (baris.penggunaId) {
    const [u] = await db
      .select()
      .from(pengguna)
      .where(eq(pengguna.id, baris.penggunaId))
      .limit(1);
    user = u ?? null;
    if (!user) {
      // Akun dihapus admin — rapikan sesinya supaya tidak ada sessions yatim.
      await db.delete(sesi).where(eq(sesi.id, id));
      return { id: null, data: {}, user: null };
    }
  }

  return { id, data, user };
});

/** Buat sesi baru (dipakai saat login / daftar). */
export async function buatSesi(penggunaId?: number): Promise<string> {
  const id = crypto.randomUUID();
  await getDb().insert(sesi).values({
    id,
    penggunaId: penggunaId ?? null,
    data: JSON.stringify({}),
    kedaluwarsa: new Date(Date.now() + MAKA),
  });
  const store = await cookies();
  store.set(COOKIE, `${id}.${sign(id)}`, opsiCookie(new Date(Date.now() + MAKA)));
  return id;
}

/** Hapus sesi sekarang (logout). */
export async function hancurkanSesi(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const id = unsign(token);
    if (id) await getDb().delete(sesi).where(eq(sesi.id, id));
  }
  store.delete(COOKIE);
}

/** Pengguna yang login, atau null. */
export async function currentUser(): Promise<Pengguna | null> {
  return (await getSesi()).user;
}

/**
 * Simpan perubahan ke data sesi (flash, oauth_state, dll).
 *
 * Selalu menulis ke database langsung supaya request berikutnya membaca
 * nilai terbaru.
 *
 * Kalau ternyata belum ada sesi sama sekali (mis. tamu yang gagal login),
 * sesinya dibuat lebih dulu — cookie hanya boleh diubah dari Server Action
 * atau Route Handler, dan pemanggil `updateSesi()` memang selalu salah
 * keduanya. Tanpa ini, pesan "password salah" akan hilang sebelum tampil.
 */
export async function updateSesi(ubah: (d: DataSesi) => DataSesi): Promise<void> {
  const sekarang = await getSesi();
  const punyaSesi = sekarang.id !== null;
  const id = sekarang.id ?? (await buatSesi());
  const data = punyaSesi ? sekarang.data : {};

  await getDb()
    .update(sesi)
    .set({ data: JSON.stringify(ubah({ ...data })) })
    .where(eq(sesi.id, id));
}

/** Buang semua sesi kedaluwarsa (dipanggil dari instrumentation). */
export async function bersihkanSesi(): Promise<void> {
  await getDb().delete(sesi).where(lt(sesi.kedaluwarsa, new Date()));
}

export { COOKIE as COOKIE_SESI };
export type { Peran };