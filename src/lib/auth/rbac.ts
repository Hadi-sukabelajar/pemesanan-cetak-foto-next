/**
 * Pembatasan akses berbasis peran.
 *
 * Aturan yang dijaga di sini (sudah pernah jadi bug di versi PHP):
 *  - Halaman siswa HANYA untuk role `user`. Dulu `require_login()` dipakai
 *    sehingga guru/fotografer bisa menghapus & mengubah pesanan siswa.
 *  - Guru = read-only, hanya boleh membuka Monitor.
 *  - Fotografer = hanya boleh upload foto.
 *  - Bukti transfer tidak boleh dibuka guru (lihat bukti.ts).
 */
import 'server-only';
import { redirect } from 'next/navigation';
import { currentUser } from './session';
import type { Pengguna, Peran } from '@/lib/db/schema';

/** Halaman utama tiap peran. */
export function homePath(u: Pick<Pengguna, 'peran'>): string {
  switch (u.peran) {
    case 'admin':
      return '/dashboard';
    case 'guru':
      return '/monitor';
    case 'fotografer':
      return '/upload-foto';
    default:
      return '/pesan';
  }
}

/** Sudah login? Kalau belum -> ke halaman masuk. */
export async function wajibLogin(): Promise<Pengguna> {
  const u = await currentUser();
  if (!u) redirect('/masuk');
  return u;
}

/**
 * Wajib akun siswa (role 'user').
 * Guru/fotografer/admin yang(negat) ini akan diarahkan ke halamannya sendiri.
 */
export async function wajibSiswa(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (u.peran !== 'user') redirect(homePath(u));
  return u;
}

/** Admin & guru boleh membuka Monitor. */
export async function wajibStaf(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (u.peran !== 'admin' && u.peran !== 'guru') redirect(homePath(u));
  return u;
}

export async function wajibAdmin(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (u.peran !== 'admin') redirect(homePath(u));
  return u;
}

/** Admin & fotografer boleh upload foto hasil. */
export async function wajibFoto(): Promise<Pengguna> {
  const u = await wajibLogin();
  if (u.peran !== 'admin' && u.peran !== 'fotografer') redirect(homePath(u));
  return u;
}

/** Apakah admin (dipakai untuk menentukan tampilan tombol). */
export function isAdmin(u: Pengguna | null): boolean {
  return u?.peran === 'admin';
}

/** Admin atau guru (untuk halaman monitor yang read-only). */
export function isStaf(u: Pengguna | null): boolean {
  return u?.peran === 'admin' || u?.peran === 'guru';
}

/**
 * Pesanan yang boleh dibuka user ini.
 *  - admin & guru : semua pesanan (untuk kuitansi & monitor, read-only)
 *  - selain itu   : hanya pesanan miliknya sendiri
 */
export function bolehBukaPesanan(
  u: Pengguna,
  pesananPenggunaId: number | null,
): boolean {
  if (u.peran === 'admin' || u.peran === 'guru') return true;
  return pesananPenggunaId !== null && pesananPenggunaId === u.id;
}

/**
 * Bukti transfer lebih sensitif (berisi nomor rekening & nama pemesan),
 * jadi HANYA pemilik pesanan dan admin — bukan guru.
 */
export function bolehBukaBukti(u: Pengguna, pesananPenggunaId: number | null): boolean {
  if (u.peran === 'admin') return true;
  return pesananPenggunaId !== null && pesananPenggunaId === u.id;
}

export type { Peran };