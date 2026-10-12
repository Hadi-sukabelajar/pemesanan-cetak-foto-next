'use server';

import { redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pengguna } from '@/lib/db/schema';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { buatSesi } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { teks, potong } from '@/lib/input';

/**
 * Buat admin pertama untuk instalasi baru. Padanan setup.php.
 *
 * Aturan keamanannya:
 *  - hanya jalan selama BELUM ada admin sama sekali; begitu satu dibuat,
 *    halaman ini otomatis terkunci permanen,
 *  - password minimal 8 karakter,
 *  - bila SETUP_KEY diisi di environment, kode itu wajib dimasukkan —
 *    mencegah orang lain membuat admin di server yang baru di-online.
 *
 * Berbeda dari setup.php, halaman ini tidak perlu dihapus manual dari
 * server karena mengunci dirinya sendiri.
 */

const POLA_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const POLA_USERNAME = /^[a-z0-9_.-]{3,50}$/;

/** True kalau masih ada jalan membuat admin pertama. */
export async function setupMasihDibuka(): Promise<boolean> {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(pengguna)
    .where(eq(pengguna.peran, 'admin'));
  return Number(n) === 0;
}

export async function aksiBuatAdmin(formData: FormData): Promise<void> {
  const db = getDb();

  // Periksa lagi di server, bukan hanya di halaman: kalau ada admin lain
  // yang dibuat bersamaan, permintaan ini harus ditolak.
  if (!(await setupMasihDibuka())) {
    await flash('bad', 'Setup sudah selesai (admin sudah ada).');
    redirect('/masuk');
  }

  if (!(await csrfAman(formData))) redirect('/setup');

  const nama = potong(teks(formData.get('nama')), 100);
  const username = potong(teks(formData.get('username')), 50).toLowerCase();
  const email = potong(teks(formData.get('email')), 150).toLowerCase();
  const password = teks(formData.get('password'));
  const password2 = teks(formData.get('password2'));
  const key = teks(formData.get('key'));

  const errors: string[] = [];

  const setupKey = process.env.SETUP_KEY ?? '';
  if (setupKey !== '' && key !== setupKey) {
    errors.push('Kode setup salah.');
  }
  if (nama === '') errors.push('Nama wajib diisi (maks. 100 karakter).');
  if (!POLA_USERNAME.test(username)) {
    errors.push('Username 3-50 karakter (huruf kecil, angka, titik, strip, underscore).');
  }
  if (!POLA_EMAIL.test(email) || email.length > 150) errors.push('Format email tidak valid.');
  if (password.length < 8) errors.push('Password minimal 8 karakter.');
  if (password !== password2) errors.push('Konfirmasi password tidak sama.');

  if (errors.length === 0) {
    const bentrok = await db
      .select({ id: pengguna.id })
      .from(pengguna)
      .where(eq(pengguna.email, email))
      .limit(1);
    if (bentrok.length) {
      errors.push('Email tersebut sudah terdaftar. Hapus akunnya dulu lewat menu Pengguna.');
    }
  }
  if (errors.length === 0) {
    const bentrok = await db
      .select({ id: pengguna.id })
      .from(pengguna)
      .where(eq(pengguna.username, username))
      .limit(1);
    if (bentrok.length) errors.push('Username tersebut sudah dipakai. Pilih username lain.');
  }

  if (errors.length) {
    await flash('bad', errors.join(' '));
    redirect('/setup');
  }

  await db.insert(pengguna).values({
    nama,
    username,
    email,
    password: await hashPassword(password),
    peran: 'admin',
  });

  // Langsung masuk sebagai admin yang baru dibuat.
  const [baru] = await db
    .select()
    .from(pengguna)
    .where(and(eq(pengguna.email, email), eq(pengguna.peran, 'admin')))
    .limit(1);

  if (baru) await buatSesi(baru.id);

  await flash(
    'ok',
    'Admin pertama dibuat. Halaman /setup kini terkunci. Lanjut isi menu Pengaturan.',
  );
  redirect('/pengaturan');
}