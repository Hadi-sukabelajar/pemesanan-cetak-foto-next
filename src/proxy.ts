import { NextResponse, type NextRequest } from 'next/server';

/**
 * Memastikan cookie CSRF selalu ada.
 *
 * Token CSRF memakai pola double-submit: nilai yang sama diletakkan di cookie
 * (di sini) dan di field form. Server Actions membandingkan keduanya.
 *
 * Kenapa harus lewat proxy? Cookie hanya boleh diubah di Server Action atau
 * Route Handler — bukan saat render halaman. Halaman `/masuk` butuh token
 * untuk tamu yang belum punya sesi sama sekali, jadi tokennya disiapkan
 * lebih dulu di sini.
 */
export const CSRF_COOKIE = 'fp_csrf';

export function proxy(req: NextRequest) {
  // Sudah punya token -> teruskan tanpa perubahan.
  if (req.cookies.get(CSRF_COOKIE)?.value) return NextResponse.next();

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const res = NextResponse.next();
  res.cookies.set(CSRF_COOKIE, token, {
    // Harus bisa dibaca JavaScript supaya nilainya bisa dimasukkan ke form.
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export const config = {
  // Jangan jalankan untuk aset statis.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|img/).*)'],
};