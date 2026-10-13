/**
 * Tujuan redirect setelah sebuah aksi.
 *
 * Asalnya (versi PHP) `safe_back()` hanya menerima path yang diawali
 * `admin/`, jadi ditulis di folder admin saja. Pola itu sudah tidak relevan di
 * Next.js, yang memakai route seperti `/transaksi/40` atau `/pesanan`.
 *
 * Kalau POLA lamanya masih dipakai, SEMUA nilai `back` dari form admin
 * ditolak dan jatuh ke halaman cadangan — artinya setiap tombol "Tandai
 * lunas", "Tolak bukti", "Ubah status", atau "Hapus" melempar admin ke
 * dashboard, bukan kembali ke halaman yang sedang dikerjakan.
 *
 * Yang tetap dijaga di sini:
 *  - tujuan wajib path INTERNAL (diawali satu `/`),
 *  - `//host` dan `\` ditolak supaya tidak jadi open redirect,
 *  - `.` / `..` ditolak (termasuk bentuk URL-encode) supaya tidak ada path
 *    traversal,
 *  - karakter kontrol (newline, NUL) ditolak supaya tidak bisa merusak
 *    header Location.
 */

const KARAK_KONTROL = /[\r\n\0]/;
const TRAVERSAL = /(^|\/)\.\.?(?:\/|\?|$)/;

/** Path internal yang aman untuk dijadikan tujuan redirect. */
export function jalurInternalAman(path: string): boolean {
  if (path === '' || KARAK_KONTROL.test(path)) return false;
  // Wajib diawali satu '/', dan TIDAK boleh "//" (protocol-relative).
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('\\')) return false;

  // Periksa bentuk asli dan bentuk yang sudah di-decode, supaya
  // "/%2e%2e/" tidak lolos.
  for (const bentuk of [path, decodeURIComponent(path), decodeURIComponent(decodeURIComponent(path))]) {
    if (KARAK_KONTROL.test(bentuk)) return false;
    if (bentuk.startsWith('//') || bentuk.includes('\\')) return false;
    if (TRAVERSAL.test(bentuk)) return false;
  }
  return true;
}

/** Bersihkan nilai `back` dari form; selalu mengembalikan path internal. */
export function safeBack(
  nilai: string | null | undefined,
  cadangan = '/dashboard',
): string {
  if (!nilai) return cadangan;
  const [path] = nilai.split('#');
  return jalurInternalAman(path) ? path : cadangan;
}

/**
 * Sama seperti safeBack, dipakai untuk halaman siswa/user.
 * Perbedaannya hanya nilai cadangannya.
 */
export function safeInternal(
  nilai: string | null | undefined,
  cadangan: string,
): string {
  return safeBack(nilai, cadangan);
}