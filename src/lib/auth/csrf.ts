/**
 * Token CSRF dengan pola double-submit.
 *
 * Middleware (src/middleware.ts) assures cookie `fp_csrf` selalu ada, lalu
 * nilainya yang sama dimasukkan ke setiap form. Server Actions membandingkan
 * nilai di form dengan nilai di cookie.
 *
 * Cara ini dipilih karena cookie tidak boleh diubah saat render halaman —
 * sedangkan tamu yang belum login tetap butuh token untuk form masuk/daftar.
 * Next.js sendiri juga sudah memverifikasi Origin/Host untuk Server Actions,
 * jadi token ini adalah lapisan kedua.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { flash } from '@/lib/flash';

const COOKIE = 'fp_csrf';

/** Ambil token untuk ditaruh di field form tersembunyi. */
export async function csrfToken(): Promise<string> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? '';
}

/** Bandingkan dua string dengan waktu tetap (timing-safe). */
function sama(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Periksa token dari form.
 *
 * Mengembalikan true bila sah. Kalau tidak, pesan flash disetel supaya
 * pemanggil cukup `redirect()` — tanpa melempar error 500 ke pengguna.
 */
export async function csrfAman(formData: FormData): Promise<boolean> {
  const store = await cookies();
  const tersimpan = store.get(COOKIE)?.value ?? '';
  const dikirim = formData.get('_csrf');

  const sah =
    typeof dikirim === 'string' && dikirim.length > 0 && sama(dikirim, tersimpan);
  if (sah) return true;

  await flash(
    'bad',
    'Sesi formulir kedaluwarsa. Muat ulang halaman, lalu coba lagi.',
  );
  return false;
}