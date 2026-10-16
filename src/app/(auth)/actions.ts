'use server';

import { redirect } from 'next/navigation';
import { eq, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { pengguna, kelas } from '@/lib/db/schema';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { buatSesi, hancurkanSesi, getSesi, updateSesi } from '@/lib/auth/session';
import { homePath } from '@/lib/auth/rbac';
import { csrfAman } from '@/lib/auth/csrf';
import {
  ipPeminat,
  terlaluBanyakGagal,
  catatGagal,
  bersihkanGagal,
} from '@/lib/auth/rate-limit';
import { teks, potong } from '@/lib/input';
import { flash } from '@/lib/flash';
import { teleponSah } from '@/lib/telepon';

/** Server Action: masuk. */
export async function aksiMasuk(formData: FormData): Promise<void> {
  if (!(await csrfAman(formData))) redirect('/masuk');

  const email = teks(formData.get('email')).toLowerCase();
  const password = teks(formData.get('password'), '');
  const ip = await ipPeminat();

  if (email === '' || password === '') {
    await flash('bad', 'Email/username dan password wajib diisi.');
    redirect('/masuk');
  }

  // Pembatas percobaan dicek SEBELUM password diuji, supaya brute force
  // tidak bisa melewati batas hanya dengan menebak terus.
  if (await terlaluBanyakGagal(ip, email)) {
    await flash('bad', 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.');
    redirect('/masuk');
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(pengguna)
    .where(or(eq(pengguna.email, email), eq(pengguna.username, email)))
    .limit(1);

  // Password NULL = akun daftar lewat Google.
  if (user && !user.password) {
    await flash('bad', 'Akun ini terdaftar lewat Google. Gunakan tombol "Masuk dengan Google".');
    redirect('/masuk');
  }

  const benar = user ? await verifyPassword(password, user.password) : false;

  if (!user || !benar) {
    await catatGagal(ip, email);
    // Pesan sama untuk email salah maupun password salah, supaya tidak
    // bisa dipakai menebak email mana yang terdaftar.
    await flash('bad', 'Email/username atau password salah.');
    redirect('/masuk');
  }

  await bersihkanGagal(ip, email);
  await buatSesi(user.id);
  redirect(homePath(user));
}

/** Server Action: daftar akun siswa baru. */
export async function aksiDaftar(formData: FormData): Promise<void> {
  if (!(await csrfAman(formData))) redirect('/daftar');

  const nama = potong(teks(formData.get('nama')), 100);
  const email = potong(teks(formData.get('email')), 150).toLowerCase();
  const teleponMasukan = potong(teks(formData.get('telepon')), 20);
  const telepon = teleponMasukan === '' ? '' : (teleponSah(teleponMasukan) ?? '');
  const kelasId = Number(teks(formData.get('kelas_id'))) || 0;
  const password = teks(formData.get('password'), '');
  const password2 = teks(formData.get('password2'), '');

  const errors: string[] = [];
  if (nama === '') errors.push('Nama wajib diisi (maks. 100 karakter).');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 150) {
    errors.push('Format email tidak valid.');
  }
  if (password.length < 6) errors.push('Password minimal 6 karakter.');
  if (password !== password2) errors.push('Konfirmasi password tidak sama.');
  if (teleponMasukan !== '' && telepon === '') {
    errors.push('Nomor HP tidak valid. Gunakan format 08xx (mis. 081234567890).');
  }

  const db = getDb();

  let kelasValid: number | null = null;
  if (kelasId > 0) {
    const [k] = await db
      .select({ id: kelas.id })
      .from(kelas)
      .where(eq(kelas.id, kelasId))
      .limit(1);
    kelasValid = k?.id ?? null;
  }

  if (errors.length === 0) {
    const [ada] = await db
      .select({ id: pengguna.id })
      .from(pengguna)
      .where(eq(pengguna.email, email))
      .limit(1);
    if (ada) errors.push('Email sudah terdaftar. Silakan login.');
  }

  if (errors.length) {
    await flash('bad', errors.join(' '));
    redirect('/daftar');
  }

  const [baru] = await db
    .insert(pengguna)
    .values({
      nama,
      email,
      telepon: telepon === '' ? null : telepon,
      password: await hashPassword(password),
      peran: 'user',
      kelasId: kelasValid,
    })
    .returning({ id: pengguna.id });

  await buatSesi(baru.id);
  await flash('ok', 'Pendaftaran berhasil. Selamat datang!');
  redirect('/pesan');
}

/**
 * Server Action: keluar.
 *
 * Dipanggil dari <form> (POST), bukan dari tautan GET — supaya orang lain
 * tidak bisa memaksa pengguna keluar hanya dengan menempelkan <img src="/keluar">.
 * Cookie juga hanya boleh diubah dari Server Action/Route Handler, bukan
 * saat render halaman.
 */
export async function aksiKeluar(formData: FormData): Promise<void> {
  if (!(await csrfAman(formData))) redirect('/');
  await hancurkanSesi();
  await flash('ok', 'Kamu sudah keluar.');
  redirect('/');
}

/** Simpan state OAuth (token anti-pemalsuan) sebelum ke Google. */
export async function simpanOauthState(state: string): Promise<void> {
  await updateSesi((d) => ({ ...d, oauthState: state }));
}

/** Ambil lalu hapus state OAuth (dipakai sekali saat callback). */
export async function ambilOauthState(): Promise<string | null> {
  const { data } = await getSesi();
  const s = data.oauthState ?? null;
  await updateSesi((d) => ({ ...d, oauthState: undefined }));
  return s;
}