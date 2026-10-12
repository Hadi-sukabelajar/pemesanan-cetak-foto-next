'use server';

import { ambilFlash } from '@/lib/flash';

/**
 * Menampilkan pesan flash yang tersimpan di sesi.
 *
 * Flash diambil tepat sekali saat render lalu dikosongkan, supaya pesan
 * yang sama tidak muncul lagi ketika pengguna me-refresh halaman.
 * Diletakkan di root layout supaya berlaku untuk semua halaman.
 */
export async function AmbilFlash() {
  const daftar = await ambilFlash();
  if (daftar.length === 0) return null;
  return (
    <>
      {daftar.map((f, i) => (
        <div key={i} className={`alert a-${f.type}`}>
          {f.msg}
        </div>
      ))}
    </>
  );
}