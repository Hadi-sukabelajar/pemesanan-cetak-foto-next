'use server';

import { redirect } from 'next/navigation';
import { csrfAman } from '@/lib/auth/csrf';
import { flash } from '@/lib/flash';
import { ipPeminat, terlaluBanyakGagal, catatGagal, bersihkanGagal } from '@/lib/auth/rate-limit';
import { teks } from '@/lib/input';
import { normalTelepon, teleponValid } from '@/lib/telepon';
import { cariPesananTamu, simpanIzinTamu } from '@/lib/tamu';

/**
 * Cek pesanan tanpa login — padanan cek.php.
 *
 * Pemesan memasukkan kode pesanan + nomor HP yang dipakai saat memesan.
 * Kalau cocok, token pesanan disimpan ke sesinya lalu dia diarahkan ke
 * kuitansi, sehingga tidak perlu mengetik kode lagi.
 *
 * Aturan keamanan:
 *  - kode dan nomor HP harus cocok PERSIS dengan yang tersimpan,
 *  - percobaan dibatasi (memakai penghitung rate-limit yang sama dengan
 *    login, jadi brute force kode tidak mungkin berhasil),
 *  - pesan galat selalu sama supaya tidak bisa dipakai menebak kode mana
 *    yang terdaftar.
 */
export async function aksiCekPesanan(formData: FormData): Promise<void> {
  if (!(await csrfAman(formData))) redirect('/cek');

  const kode = teks(formData.get('kode')).toUpperCase().slice(0, 30);
  const telepon = normalTelepon(teks(formData.get('telepon')).slice(0, 20));
  const ip = ipPeminat();

  if (kode === '' || telepon === '') {
    await flash('bad', 'Kode pesanan dan nomor HP wajib diisi.');
    redirect('/cek');
  }
  if (!teleponValid(telepon)) {
    await flash('bad', 'Nomor HP tidak valid. Gunakan format 08xx (mis. 081234567890).');
    redirect('/cek');
  }

  // Batasi percobaan: kunci memakai kode+nomor HP, jadi satu orang tidak
  // bisa terkunci hanya karena mencoba banyak nomor berbeda.
  const kunciGagal = `cek:${ip}|${kode}|${telepon}`;
  if (await terlaluBanyakGagal(ip, kunciGagal)) {
    await flash(
      'bad',
      'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.',
    );
    redirect('/cek');
  }

  const hasil = await cariPesananTamu(kode, telepon);

  if (!hasil) {
    await catatGagal(ip, kunciGagal);
    await flash(
      'bad',
      'Pesanan tidak ditemukan. Pastikan kode pesanan dan nomor HP sama dengan saat memesan.',
    );
    redirect('/cek');
  }

  await bersihkanGagal(ip, kunciGagal);
  await simpanIzinTamu(hasil.id, hasil.token);
  await flash('ok', 'Pesanan ditemukan. Ini kuitansi Anda.');
  redirect(`/kuitansi/${hasil.id}`);
}
