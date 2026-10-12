'use client';

import { useEffect } from 'react';

/**
 * Mendaftarkan service worker (PWA).
 *
 * Hanya di produksi: saat development, cache aset membuat hot-reload terasa
 * lambat dan sering menampilkan versi lama.
 */
export function DaftarkanServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const daftar = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // PWA hanyalah tambahan; kegagalan daftar tidak boleh mengganggu aplikasi.
      });
    };

    // Daftarkan setelah halaman selesai dimuat supaya tidak berebut
    // dengan sumber daya yang lebih penting.
    if (document.readyState === 'complete') daftar();
    else window.addEventListener('load', daftar, { once: true });
  }, []);

  return null;
}