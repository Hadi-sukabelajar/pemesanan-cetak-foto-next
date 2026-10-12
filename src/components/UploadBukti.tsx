'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

/**
 * Unggah bukti transfer langsung dari browser ke Vercel Blob.
 *
 * Kenapa langsung ke storage, bukan lewat server?
 * Batas body Vercel Functions hanya 4,5 MB. Bukti transfer dibatasi 2 MB
 * jadi masih muat, tapi foto hasil bisa sampai 15 MB dan TIDAK akan muat
 * kalau lewat server. Pola client-direct ini membuat berkas melompati
 * server sepenuhnya, sehingga ukurannya bebas.
 *
 * Keamanan tetap dijaga: sebelum memberi token, server memeriksa peran
 * pengguna dan status pesanannya; setelah berkas sampai, server memverifikasi
 * ulang ukuran dan magic bytes-nya sebelum menyimpan pathname-nya.
 */
export function UploadBukti({ onSelesai }: { onSelesai: (pathname: string) => void }) {
  const [status, setStatus] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function pilihBerkas(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus('Pilih file bukti transfer terlebih dahulu.');
      return;
    }

    setStatus('Mengunggah...');
    try {
      const hasil = await upload(file.name, file, {
        access: 'private',
        handleUploadUrl: '/api/unggah-token',
        onUploadProgress: ({ percentage }: { percentage: number }) => {
          setStatus(`Mengunggah... ${Math.round(percentage)}%`);
        },
      });

      // Verifikasi ulang di server sebelum pathname dipakai.
      const cek = await fetch('/api/unggah-simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: hasil.pathname }),
      });
      const data = await cek.json();
      if (!cek.ok || !data.ok) {
        setStatus(data.pesan ?? 'Berkas tidak bisa dipakai.');
        return;
      }

      setNama(data.nama ?? file.name);
      onSelesai(data.pathname);
      setStatus('Bukti transfer sudah diunggah. Klik "Konfirmasi Pembayaran" untuk mengirim.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal mengunggah berkas.');
    }
  }

  return (
    <form onSubmit={pilihBerkas}>
      <label htmlFor="bukti">Upload bukti transfer</label>
      <input
        type="file"
        id="bukti"
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp,application/pdf"
      />
      <div className="row mt">
        <button className="btn ghost sm" type="submit">
          Unggah bukti
        </button>
        {nama && <span className="muted">Tersimpan: {nama}</span>}
      </div>
      {status && <div className="hint">{status}</div>}
    </form>
  );
}