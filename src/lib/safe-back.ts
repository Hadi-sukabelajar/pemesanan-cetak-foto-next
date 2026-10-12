/**
 * Tujuan redirect setelah aksi admin.
 *
 * Di PHP ada bug: `safe_back()` hanya mengecek pola `^admin/[...]` yang
 * mengizinkan titik dan garis miring, sehingga `back=admin/../../evil.php`
 * lolos dan menerbitkan Location ke luar aplikasi (open redirect /
 * path traversal). Sekarang setiap segmen "." dan ".." ditolak, termasuk
 * bentuk URL-encode seperti `admin/%2e%2e/`.
 */

const POLA = /^admin\/[A-Za-z0-9_./?=&%+-]*$/;

/** Hanya izinkan path di dalam folder admin/ (tanpa query string bebas). */
function jalurAman(path: string): boolean {
  if (path === '' || path.includes('\r') || path.includes('\n') || path.includes('\0')) {
    return false;
  }
  if (!POLA.test(path)) return false;
  // Periksa bentuk asli dan bentuk yang sudah di-decode.
  const bentuk = [path, decodeURIComponent(path), decodeURIComponent(decodeURIComponent(path))];
  for (const b of bentuk) {
    if (/(^|\/)\.\.?(?:\/|\?|$)/.test(b)) return false;
    if (b.includes('//')) return false;
  }
  return true;
}

/** Bersihkan nilai `back` dari form; selalu mengembalikan path yang aman. */
export function safeBack(nilai: string | null | undefined, cadangan = '/dashboard'): string {
  if (!nilai) return cadangan;
  const [path] = nilai.split('#');
  return jalurAman(path) ? path : cadangan;
}

/**
 * Sama seperti safeBack, tapi untuk halaman siswa/user.
 * Menerima path internal apa pun yang diawali "/".
 */
export function safeInternal(nilai: string | null | undefined, cadangan: string): string {
  if (!nilai) return cadangan;
  if (!nilai.startsWith('/')) return cadangan;
  if (nilai.startsWith('//') || nilai.includes('\\')) return cadangan;
  if (nilai.includes('\r') || nilai.includes('\n') || nilai.includes('\0')) return cadangan;
  return nilai;
}