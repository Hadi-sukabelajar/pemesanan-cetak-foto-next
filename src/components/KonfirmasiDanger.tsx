'use client';

import { useEffect } from 'react';

/**
 * Konfirmasi untuk tombol berbahaya.
 *
 * Dipasang sekali di layout supaya berlaku untuk semua <form> yang memakai
 * atribut data-confirm (setara perilaku versi PHP).
 */
export function KonfirmasiDanger() {
  useEffect(() => {
    const handler = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      const pesan = form?.getAttribute('data-confirm');
      if (pesan && !window.confirm(pesan)) {
        e.preventDefault();
      }
    };
    document.addEventListener('submit', handler);
    return () => document.removeEventListener('submit', handler);
  }, []);
  return null;
}