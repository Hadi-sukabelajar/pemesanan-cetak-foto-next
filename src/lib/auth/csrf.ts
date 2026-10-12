/**
 * Token CSRF.
 *
 * Token disimpan di data sesi lalu dimasukkan ke setiap form lewat field
 * tersembunyi. Server Actions Next.js sudah memverifikasi Origin/Host,
 * jadi ini lapisan kedua (defence in depth) sekaligus mempertahankan
 * perilaku yang sama dengan versi PHP.
 */
import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getSesi, updateSesi } from './session';

export async function csrfToken(): Promise<string> {
  const { data } = await getSesi();
  if (data.csrf) return data.csrf;
  const baru = randomBytes(32).toString('hex');
  await updateSesi((d) => ({ ...d, csrf: baru }));
  return baru;
}

/** Bandingkan dua string dengan waktu tetap (timing-safe). */
function sama(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Periksa token dari form. Melempar error kalau tidak cocok, jadi
 * pemanggil cukup `await verifikasiCsrf(formData)` lalu lanjut.
 */
export async function verifikasiCsrf(formData: FormData): Promise<void> {
  const { data } = await getSesi();
  const kirim = formData.get('_csrf');
  const disimpan = data.csrf ?? '';

  const sah =
    typeof kirim === 'string' && kirim.length > 0 && sama(kirim, disimpan);

  if (!sah) {
    throw new Error(
      'Sesi formulir kedaluwarsa. Kembali, muat ulang halaman, lalu coba lagi.',
    );
  }
}