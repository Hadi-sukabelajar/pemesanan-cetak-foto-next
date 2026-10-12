/**
 * Flash message — padanan flash()/get_flash() PHP.
 *
 * Kenapa cookie, bukan kolom di tabel `sesi`?
 *
 * Flash di Versi pertama disimpan di data sesi lalu dihapus saat render.
 * Itu rapuh: satu respons server action bisa undergo beberapa kali render
 * pass (stream HTML + payload RSC), sehingga beberapa pass membaca flash
 * yang sama dan pass pertama yang tiba duluan menghapusnya dari database.
 * Pass yang dipakai browser kadang dapat flash, kadang tidak — pesan
 * "password salah" jadi muncul tenggelam secara tidak menentu.
 *
 * Cookie tidak suffers masalah itu:
 *  - ditulis sekali di Server Action (`cookies().set`),
 *  - dibaca tanpa mengubah apa pun saat render, jadi semua render pass
 *    melihat pesan yang sama,
 *  - dihapus oleh klien lewat komponen FlashList setelah tampil.
 *
 * Isinya hanya pesan yang dibuat aplikasi sendiri, jadi aman diletakkan di
 * cookie yang bisa dibaca JavaScript (dibutuhkan agar bisa dihapus).
 */
import 'server-only';
import { cookies } from 'next/headers';

export type Flash = { type: 'ok' | 'bad' | 'warn' | 'info'; msg: string };

const COOKIE = 'fp_flash';
/** Cukup untuk satu redirect; kalau lewat, pesannya sudah basi. */
const MAKA_DETIK = 120;
const MAKS = 3;

function baca(nilai: string | undefined): Flash[] {
  if (!nilai) return [];
  try {
    const parsed: unknown = JSON.parse(nilai);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is Flash =>
        typeof f === 'object' &&
        f !== null &&
        typeof (f as Flash).msg === 'string' &&
        ['ok', 'bad', 'warn', 'info'].includes((f as Flash).type),
    );
  } catch {
    return [];
  }
}

/** Simpan pesan untuk ditampilkan sekali setelah redirect. */
export async function flash(type: Flash['type'], msg: string): Promise<void> {
  const store = await cookies();
  const daftar = [...baca(store.get(COOKIE)?.value), { type, msg } satisfies Flash].slice(-MAKS);

  store.set(COOKIE, JSON.stringify(daftar), {
    path: '/',
    // Harus bisa dihapus JavaScript, makanya bukan httpOnly.
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAKA_DETIK,
  });
}

/**
 * Ambil pesan flash untuk ditampilkan.
 *
 * Sengaja TIDAK menghapus apa pun: pemanggil boleh dipanggil berkali-kali
 * dalam satu respons dan semua harus melihat hasil yang sama.
 * Penghapusan dilakukan klien setelah pesannya tampil.
 */
export async function ambilFlash(): Promise<Flash[]> {
  return baca((await cookies()).get(COOKIE)?.value);
}

export { COOKIE as COOKIE_FLASH };