/**
 * Izin akses ke sebuah pesanan.
 *
 * Sebuah pesanan bisa dibuka oleh tiga pihak:
 *
 *  1. Admin & guru — untuk memantau dan memproses,
 *  2. pemiliknya, bila pesanan itu dibuat dari akun yang sedang login,
 *  3. siapa pun yang memegang **token** pesanan — termasuk pemesan tanpa
 *     akun, yang kembali ke pesanannya lewat halaman /cek.
 *
 * Token adalah bearer credential: 128 bit acak, mustahil ditebak, tapi
 * Begitu dibagikan atau bocor (mis. lewat tautan yang tersimpan di browser
 * orang lain) ia langsung memberi akses penuh ke isi pesanan tersebut.
 * Karena itu token tidak boleh dicetak di halaman yang bisa dilihat orang
 * lain, dan tidak boleh ikut masuk ke halaman yang di-cache publik.
 */

import type { Pengguna } from '@/lib/db/schema';

export type PesananMinimal = {
  penggunaId: number | null;
  token: string | null;
};

/** Admin & guru boleh melihat semua pesanan. */
export function bolehBukaPesanan(
  u: Pengguna | null,
  p: PesananMinimal,
  tokenDimiliki: string | null = null,
): boolean {
  if (u && (u.peran === 'admin' || u.peran === 'guru')) return true;
  if (u && p.penggunaId !== null && p.penggunaId === u.id) return true;
  return tokenCocok(p.token, tokenDimiliki);
}

/**
 * Bukti transfer lebih sensitif (memuat nomor rekening & nama pemesan),
 * jadi HANYA pemilik pesanan, admin, atau pemegang token — bukan guru.
 */
export function bolehBukaBukti(
  u: Pengguna | null,
  p: PesananMinimal,
  tokenDimiliki: string | null = null,
): boolean {
  if (u?.peran === 'admin') return true;
  if (u && p.penggunaId !== null && p.penggunaId === u.id) return true;
  return tokenCocok(p.token, tokenDimiliki);
}

/** Bandingkan dua token dengan waktu tetap, panjang harus sama. */
export function tokenCocok(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length || a.length !== 32) return false;

  let beda = 0;
  for (let i = 0; i < a.length; i++) {
    beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return beda === 0;
}