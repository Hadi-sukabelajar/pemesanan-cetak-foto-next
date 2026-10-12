'use client';

import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { UnggahLangsung } from '@/components/UnggahLangsung';
import { aksiSimpanFoto } from './actions';

/**
 * Unggah foto hasil untuk satu pesanan.
 *
 * Alurnya: unggah dulu ke penyimpanan (client-direct, karena 15 MB tidak
 * muat lewat server), lalu server action menyimpan pathname-nya ke pesanan.
 * Memakai server action dari client berarti kita tidak perlu mengirim
 * pathname lewat input tersembunyi yang bisa dimanipulasi.
 */
export function UnggahFotoForm({
  id,
  back,
  kode,
  sudahAda,
}: {
  id: string;
  back: string;
  kode: string;
  sudahAda: boolean;
}) {
  const pathname = useRef('');
  const [sibuk, setSibuk] = useState(false);
  const [siap, setSiap] = useState(false);
  const [nama, setNama] = useState('');

  async function simpan() {
    if (!pathname.current) return;
    setSibuk(true);
    const fd = new FormData();
    fd.set('id', id);
    fd.set('pathname', pathname.current);
    fd.set('nama_file', nama);
    fd.set('back', back);
    await aksiSimpanFoto(fd);
    // Server selalu redirect, jadi baris di bawah hanya reached bila gagal.
    setSibuk(false);
  }

  return (
    <div>
      <UnggahLangsung
        folder="hasil"
        accept="image/jpeg,image/png,image/webp"
        label={sudahAda ? 'Ganti foto hasil' : 'Pilih foto hasil'}
        tombol={sudahAda ? 'Unggah pengganti' : 'Unggah foto'}
        onSelesai={(hasil) => {
          pathname.current = hasil.pathname;
          setNama(hasil.nama);
          setSiap(true);
        }}
      />
      {siap && (
        <div className="row mt">
          <button
            className="btn gold sm"
            type="button"
            disabled={sibuk}
            onClick={simpan}
          >
            {sibuk ? 'Menyimpan...' : `Simpan ke pesanan ${kode}`}
          </button>
        </div>
      )}
    </div>
  );
}