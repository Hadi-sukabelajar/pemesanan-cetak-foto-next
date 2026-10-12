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

  const syarat: Syarat = {
    cari: (sp.q ?? '').trim() || undefined,
    statusBayar: sp.bayar || undefined,
    status: sp.status || undefined,
    kelasId: sp.kelas ? Number(sp.kelas) : undefined,
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
    // Cegah formula injection di Excel/LibreOffice.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  // Format nama berkas mengikuti versi PHP: date('Ymd-His') -> 20261012-205957.
  const sekarang = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const waktu =
    `${sekarang.getUTCFullYear()}${pad(sekarang.getUTCMonth() + 1)}${pad(sekarang.getUTCDate())}` +
    `-${pad(sekarang.getUTCHours())}${pad(sekarang.getUTCMinutes())}${pad(sekarang.getUTCSeconds())}`;

  const isi = baris
    .map((p) =>
      [
        p.kode,
        p.dibuatPada instanceof Date ? p.dibuatPada.toISOString() : p.dibuatPada,
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