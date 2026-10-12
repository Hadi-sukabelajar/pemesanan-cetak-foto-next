/**
 * Format & tampilan —.padanan fungsi e(), rupiah(), tgl() di PHP.
 *
 * Tanggal disimpan sebagai timestamptz (UTC) di database, lalu diformat
 * ke zona waktu sekolah di sini.
 */

const ZONA = 'Asia/Jakarta';

/**
 * Ambil bagian tanggal/jam dalam zona sekolah sebagai angka.
 * Sengaja tidak memakai toLocaleString supaya hasilnya persis seperti PHP
 * (dd/mm/YYYY HH:MM), bukan "12/10/2026, 22.23" gaya en-US.
 */
function bagian(d: Date): Record<string, string> {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const ambil = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return {
    dd: ambil('day'),
    mm: ambil('month'),
    yyyy: ambil('year'),
    hh: ambil('hour'),
    menit: ambil('minute'),
  };
}

/** Rp 180.000 */
export function rupiah(n: number | string | null | undefined): string {
  const angka = Number(n ?? 0);
  return 'Rp ' + (Number.isFinite(angka) ? angka : 0).toLocaleString('id-ID');
}

/** 12/10/2026 22:03 — atau '-' kalau null. */
export function tgl(v: Date | string | null | undefined, denganJam = true): string {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const b = bagian(d);
  return denganJam
    ? `${b.dd}/${b.mm}/${b.yyyy} ${b.hh}:${b.menit}`
    : `${b.dd}/${b.mm}/${b.yyyy}`;
}

/** Untuk atribut <input type="datetime-local"> dalam zona Jakarta. */
export function tglInput(v: Date | string | null | undefined): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const b = bagian(d);
  return `${b.yyyy}-${b.mm}-${b.dd}T${b.hh}:${b.menit}`;
}

/**
 * HTML-escape.
 * React sudah meng-escape sendiri, jadi fungsi ini hanya untuk
 *-HTML yang dibangun sebagai string mentah (mis. di CSV atau
 * di atribut yang disisipkan manual).
 */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bersihkan teks agar aman dipakai sebagai nama file. */
export function slugNama(nama: string, cadangan = 'foto'): string {
  const dasar = nama
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // buang tanda aksen
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return dasar !== '' ? dasar : cadangan.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/** Awal kapital — padanan ucfirst(). */
export function kapital(v: string | null | undefined): string {
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1);
}