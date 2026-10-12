'use client';

import { useFormStatus } from 'react-dom';

type Props = { action: (fd: FormData) => Promise<void>; csrf: string };

/**
 * Tombol "Keluar" yang tetap terlihat seperti tautan menu.
 *
 * Dipakai <form method="post"> supaya logout harus lewat POST (ada token
 * CSRF), bukan lewat GET — kalau lewat GET, siapa pun bisa memaksa pengguna
 * keluar hanya dengan menempelkan <img src="/keluar"> di halaman lain.
 */
export function KeluarForm({ action, csrf }: Props) {
  return (
    <form action={action} style={{ display: 'contents' }}>
      <input type="hidden" name="_csrf" value={csrf} />
      <TombolKeluar />
    </form>
  );
}

function TombolKeluar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="logout"
      title="Keluar"
      disabled={pending}
      style={{
        background: 'none',
        border: 0,
        padding: '.45rem .85rem',
        font: 'inherit',
        fontWeight: 600,
        fontSize: '.88rem',
        color: 'inherit',
        cursor: 'pointer',
        borderRadius: 999,
      }}
    >
      Keluar
    </button>
  );
}