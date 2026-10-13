/**
 * Normalisasi & validasi nomor HP.
 *
 * Meniru normal_telepon() dan telepon_valid() di includes/bootstrap.php
 * versi PHP, supaya pemesan yang mengetik "62 812-3456-7890", "+62812345",
 * atau "812345" tetap dikenali sebagai nomor yang sama saat dia memesan
 * tanpa login lalu kembali lewat halaman /cek.
 */

/** Buang semua karakter selain angka dan '+', lalu rapikan. */
export function normalTelepon(nilai: string): string {
  let t = nilai.replace(/[^0-9+]/g, '').replace(/^\+/, '');

  // "+62..." atau "62..." -> awalan 0
  if (t.startsWith('62')) {
    t = '0' + t.slice(2);
  } else if (t.length > 0 && t.startsWith('8')) {
    t = '0' + t;
  }
  return t;
}

/** Nomor Indonesia: 0 diikuti 8-14 digit (mis. 081234567890). */
export function teleponValid(t: string): boolean {
  return /^0[0-9]{8,14}$/.test(t);
}

/** Convenience: bersihkan lalu cek sekaligus. */
export function teleponSah(nilai: string): string | null {
  const t = normalTelepon(nilai);
  return teleponValid(t) ? t : null;
}

/**
 * Samakan nomor HP supaya tidak ada duplikat akibat format berbeda.
 * Dipakai saat membandingkan nomor yang diketik di /cek.
 */
export function telefonsama(a: string, b: string): boolean {
  const x = normalTelepon(a);
  const y = normalTelepon(b);
  if (x === '' || y === '') return false;
  return x === y;
}