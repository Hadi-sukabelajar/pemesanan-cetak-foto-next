'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Menambahkan kelas `admin-body` ke <body> saat berada di halaman admin.
 *
 * Di CSS versi PHP, sidebar admin lebar dikendalikan `body.admin-body`.
 * Karena <body> berada di root layout, kelasnya harus dipasang dari sisi
 * klien supaya bisa berubah sesuai rute.
 */
export function BodyClass() {
  const pathname = usePathname();
  useEffect(() => {
    const admin = pathname === '/dashboard' || pathname.startsWith('/admin');
    document.body.classList.toggle('admin-body', admin);
  }, [pathname]);
  return null;
}