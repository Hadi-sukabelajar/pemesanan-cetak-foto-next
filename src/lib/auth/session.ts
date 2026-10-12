/**
 * Sesi pengguna — pengganti $_SESSION PHP.
 *
 * Kenapa tidak pakai session bawaan Next.js?
 * Karena Vercel Functions bisa menjalankan beberapa instance sekaligus dan
 * cookie harus tetap valid lintas instance. Cookie stateless bisa "diisi ulang"
 * (terlihat), jadi cookie ini hanya berisi ID sesi bertanda tangan HMAC;
 * isi sesinya (csrf, flash, login_fail, oauth_state) disimpan di database.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { getDb, type Tx, type Db } from '@/lib/db';
import { sesi, pengguna, type Pengguna, type Peran } from '@/lib/db/schema';

const COOKIE = 'fp_sesi';
const MAKA = 1000 * 60 * 60 * 24 * 14; // 14 hari

/** Jenis pesan flash yang dipakai seluruh aplikasi. */
export type JenisFlash = 'ok' | 'bad' | 'warn' | 'info';

/** Data yang disimpan di baris tabel `sesi` (setara $_SESSION PHP). */
export type DataSesi = {
  csrf?: string;
  flash?: Array<{ type: JenisFlash; msg: string }>;
  loginFail?: { n: number; t: number };
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
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

// Cache per-request supaya tidak query berulang dalam satu render.
let cache: { id: string | null; data: DataSesi; user: Pengguna | null } | null = null;

async function muat(tx: Tx): Promise<{ id: string | null; data: DataSesi; user: Pengguna | null }> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return { id: null, data: {}, user: null };

  const id = unsign(token);
  if (!id) return { id: null, data: {}, user: null };

  const db = tx as unknown as Db;
  const [baris] = await db
    .select()
    .from(sesi)
    .where(eq(sesi.id, id))
    .limit(1);

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
      // Akun dihapus admin — rapikan sesinya.
      await db.delete(sesi).where(eq(sesi.id, id));
      return { id: null, data: {}, user: null };
    }
  }

  return { id, data, user };
}

function opts(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}

/** Buat sesi baru (dipakai saat login / daftar). */
export async function buatSesi(penggunaId?: number): Promise<string> {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.insert(sesi).values({
    id,
    penggunaId: penggunaId ?? null,
    data: JSON.stringify({ csrf: randomBytes(32).toString('hex') }),
    kedaluwarsa: new Date(Date.now() + MAKA),
  });
  const store = await cookies();
  store.set(COOKIE, `${id}.${sign(id)}`, opts(new Date(Date.now() + MAKA)));
  cache = null;
  return id;
}

/** Hapus sesi sekarang (logout). */
export async function hancurkanSesi(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const id = unsign(token);
    if (id) {
      await getDb().delete(sesi).where(eq(sesi.id, id));
    }
  }
  store.delete(COOKIE);
  cache = null;
}

/**
 * Sesi saat ini + pengguna yang login (kalau ada).
 * Satu baris ini menggantikan current_user() + $_SESSION PHP.
 */
export async function getSesi(): Promise<{
  id: string | null;
  data: DataSesi;
  user: Pengguna | null;
}> {
  if (cache) return cache;
  const db = getDb();
  cache = await muat(db as unknown as Tx);
  return cache;
}

/** Pengguna yang login, atau null. */
export async function currentUser(): Promise<Pengguna | null> {
  return (await getSesi()).user;
}

/** Simpan perubahan ke data sesi (csrf, flash, dll). */
export async function updateSesi(ubah: (d: DataSesi) => DataSesi): Promise<void> {
  const sekarang = await getSesi();
  if (!sekarang.id) return;
  const baru = ubah({ ...sekarang.data });
  await getDb()
    .update(sesi)
    .set({ data: JSON.stringify(baru) })
    .where(eq(sesi.id, sekarang.id));
  cache = { ...sekarang, data: baru };
}

/** Buang semua sesi kedaluwarsa (panggil berkala dari instrumentation). */
export async function bersihkanSesi(): Promise<void> {
  await getDb().delete(sesi).where(lt(sesi.kedaluwarsa, new Date()));
}

export { COOKIE as COOKIE_SESI };

// Helper kecil supaya tipe peran enak dipakai di komponen.
export type { Peran };