/**
 * Pembacaan input yang aman.
 *
 * Di PHP ada bug fatal: `trim($_POST['nama'] ?? '')` akan melempar
 * TypeError kalau field dikirim sebagai array (`nama[]=x`), yang bisa
 * dipicu siapa saja lewat crafted POST. Semua input sekarang lewat
 * helper di sini (atau zod), jadi bentuk ndarray tidak pernah sampai
 * ke fungsi pemroses string.
 */

/** Ambil nilai sebagai string; array/object dianggap tidak ada. */
export function teks(v: unknown, bawaan = ''): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return bawaan;
}

/** Sama seperti teks(), TANPA trim (untuk field yang spasinya berarti). */
export function teksMentah(v: unknown, bawaan = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return bawaan;
}

/** Ambil nilai sebagai bilangan bulat. */
export function bilangan(v: unknown, bawaan = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return bawaan;
}

/**
 * Ambil peta qty dari form: "qty[1]=2&qty[2]=1" -> Map<1,2>|<2,1>.
 * Kalau bentuknya salah (mis. "qty=abc"), hasilnya peta kosong — bukan error.
 */
export function petaQty(formData: FormData): Map<number, number> {
  const peta = new Map<number, number>();
  for (const [kunci, nilai] of formData.entries()) {
    const cocok = /^qty\[(\d+)\]$/.exec(kunci);
    if (!cocok) continue;
    const id = Number(cocok[1]);
    if (!Number.isInteger(id) || id <= 0) continue;
    const n = Array.isArray(nilai) ? nilai[0] : nilai;
    peta.set(id, typeof n === 'string' && n.trim() !== '' ? Number(n) : 0);
  }
  return peta;
}

/** Batasi panjang string (dulu mb_substr di PHP). */
export function potong(v: string, maks: number): string {
  const chars = Array.from(v);
  return chars.length <= maks ? v : chars.slice(0, maks).join('');
}

/** Sama dengan potong(), tapi selalu mengembalikan null kalau string kosong. */
export function potongAtauKosong(v: string, maks: number): string | null {
  const p = potong(v.trim(), maks);
  return p === '' ? null : p;
}

/** Hitung panjang karakter seperti mb_strlen PHP (menghitung code point). */
export function panjang(v: string): number {
  return Array.from(v).length;
}