'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Menambahkan kelas `admin-body` ke <body> saat berada di halaman staf.
 *
 * Rute admin tidak diawali `/admin` karena menggunakan grup rute `(admin)`
 * Next.js. Karena itu daftar path aktual dipakai, bukan awalan `/admin`.
 */
const HALAMAN_STAF = [
  '/dashboard',
  '/monitor',
  '/transaksi',
  '/antrian',
  '/pesanan',
  '/upload-foto',
  '/arsip',
  '/riwayat',
  '/pengguna',
  '/produk',
  '/jurusan',
  '/pengaturan',
];

export function BodyClass() {
  const pathname = usePathname();
  useEffect(() => {
    const admin = HALAMAN_STAF.some(
      (rute) => pathname === rute || pathname.startsWith(`${rute}/`),
    );
    document.body.classList.toggle('admin-body', admin);
  }, [pathname]);
  return null;
}