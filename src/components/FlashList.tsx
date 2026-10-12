'use client';

import { useEffect, useState } from 'react';
import type { Flash } from '@/lib/flash';

const COOKIE = 'fp_flash';

/**
 * Menampilkan pesan flash lalu membersihkannya.
 *
 * Cookie flash dihapus di sini (bukan saat render server) supaya semua
 * render pass dalam satu respons melihat pesan yang sama. Setelah komponen
 * ini ter-mount, cookie dibersihkan supaya pesan tidak muncul lagi saat
 * pengguna me-refresh halaman.
 */
export function FlashList({ daftar }: { daftar: Flash[] }) {
  const [tertutup, setTertutup] = useState(false);

  useEffect(() => {
    document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
  }, []);

  if (tertutup || daftar.length === 0) return null;

  return (
    <div id="flash" onClick={() => setTertutup(true)} title="Klik untuk menutup">
      {daftar.map((f, i) => (
        <div key={i} className={`alert a-${f.type}`}>
          {f.msg}
        </div>
      ))}
    </div>
  );
}