import { wajibAdmin } from '@/lib/auth/rbac';
import { daftarPesanan, type Syarat } from '@/lib/query-admin';
import { STATUS_BAYAR_LABEL, STATUS_PESANAN_LABEL } from '@/lib/orders';

/**
 * Unduh daftar pesanan sebagai CSV.
 *
 * Dua hal yang dijaga:
 *  1. Cegah formula injection: nilai yang diawali = + - @ akan merusak
 *     spreadsheet saat dibuka (padanan $safe di versi PHP).
 *  2. BOM UTF-8 ditulis di awal supaya Excel membaca karakter Indonesia dengan benar.
 */
export async function GET(request: Request) {
  await wajibAdmin();

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams);

  const kelasNum = sp.kelas ? Number(sp.kelas) : NaN;
  const syarat: Syarat = {
    cari: (sp.q ?? '').trim() || undefined,
    statusBayar: sp.bayar || undefined,
    status: sp.status || undefined,
    kelasId: Number.isInteger(kelasNum) ? kelasNum : undefined,
  };

  const baris = await daftarPesanan(syarat, { ambil: 5000 });

  const kepala = [
    'Kode',
    'Tanggal',
    'Nama',
    'Kelas',
    'Pesanan',
    'Total',
    'Metode',
    'Status Bayar',
    'No Antrian',
    'Status',
    'Nama File',
    'Catatan',
  ];

  const esc = (v: unknown): string => {
    let s = String(v ?? '');
    // Cegah formula injection di Excel/LibreOffice. Uji setelah trim kiri
    // supaya " =cmd" atau "\t@cmd" tidak lolos prefix check.
    if (/^[=+\-@\t\r]/.test(s.trimStart())) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  // Format nama berkas mengikuti versi PHP: date('Ymd-His') dalam zona Jakarta.
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const ambil = (t: string) => bagian.find((p) => p.type === t)?.value ?? '00';
  const waktu = `${ambil('year')}${ambil('month')}${ambil('day')}-${ambil('hour')}${ambil('minute')}${ambil('second')}`;

  const fmtJakarta = (v: unknown): string => {
    if (v instanceof Date) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(v);
    }
    return String(v ?? '');
  };

  const isi = baris
    .map((p) =>
      [
        p.kode,
        fmtJakarta(p.dibuatPada),
        p.nama,
        p.kelasNama,
        p.ringkas,
        p.total,
        p.metode,
        STATUS_BAYAR_LABEL[p.statusBayar]?.[0] ?? p.statusBayar,
        p.noAntrian,
        STATUS_PESANAN_LABEL[p.status]?.[0] ?? p.status,
        p.namaFile,
        p.catatan,
      ]
        .map(esc)
        .join(','),
    )
    .join('\n');

  const isiLengkap = `${kepala.join(',')}\n${isi}`;

  return new Response('﻿' + isiLengkap, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pesanan-${waktu}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}