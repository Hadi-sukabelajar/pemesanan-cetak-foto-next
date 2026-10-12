'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

/**
 * Unggah berkas langsung dari browser ke Vercel Blob.
 *
 * Kenapa langsung ke storage, bukan lewat server?
 * Batas body Vercel Functions hanya 4,5 MB. Bukti transfer dibatasi 2 MB
 * jadi masih muat, tapi foto hasil bisa sampai 15 MB dan TIDAK akan muat
 * kalau lewat server. Pola client-direct ini membuat berkas melompati
 * server sepenuhnya, sehingga ukurannya bebas.
 *
 * Keamanan tetap dijaga: sebelum memberi token, server memeriksa peran
 * pengguna dan jenis unggahan; setelah berkas sampai, server memverifikasi
 * ulang ukuran dan magic bytes-nya sebelum menyimpan pathname-nya.
 *
 * `folder` harus cocok dengan regex validasi di server ('bukti' atau 'hasil').
 */
export function UnggahLangsung({
  folder,
  accept,
  label,
  tombol,
  onSelesai,
}: {
  folder: 'bukti' | 'hasil';
  accept: string;
  label: string;
  tombol: string;
  onSelesai: (hasil: { pathname: string; nama: string }) => void;
}) {
  const [status, setStatus] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pilihBerkas(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus('Pilih berkas terlebih dahulu.');
      return;
    }

    setSibuk(true);
    setStatus('Mengunggah...');
    try {
      const hasil = await upload(`${folder}/${file.name}`, file, {
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
        body: JSON.stringify({ pathname: hasil.pathname, jenis: folder }),
      });
      const data = await cek.json();
      if (!cek.ok || !data.ok) {
        setStatus(data.pesan ?? 'Berkas tidak bisa dipakai.');
        return;
      }

      setNama(data.nama ?? file.name);
      onSelesai({ pathname: data.pathname, nama: data.nama ?? file.name });
      setStatus('Berkas sudah diunggah.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Gagal mengunggah berkas.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <form onSubmit={pilihBerkas}>
      <label htmlFor={`berkas-${folder}`}>{label}</label>
      <input
        type="file"
        id={`berkas-${folder}`}
        ref={inputRef}
        accept={accept}
        disabled={sibuk}
      />
      <div className="row mt">
        <button className="btn ghost sm" type="submit" disabled={sibuk}>
          {sibuk ? 'Mengunggah...' : tombol}
        </button>
        {nama && <span className="muted">Tersimpan: {nama}</span>}
      </div>
      {status && <div className="hint">{status}</div>}
    </form>
  );
}