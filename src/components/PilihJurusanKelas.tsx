'use client';

import { useState } from 'react';

type Jurusan = { id: number; nama: string };
type Kelas = { id: number; nama: string; jurusanId: number };

/**
 * Dropdown bertingkat: pilih jurusan dulu, lalu kelas-nya menyempit.
 *
 * Diajing ulang dari versi PHP (assets/js/app.js). Bedanya: React yang
 * mengelola state, jadi tidak perlu querySelector manual.
 *
 * `jurusan` sengaja TIDAK punya atribut name — yang dikirim ke server hanya
 * kelas, karena kelas sudah terhubung ke jurusannya.
 */
export function PilihJurusanKelas({
  jurusan,
  kelas,
  terpilihKelas = 0,
  wajib = true,
}: {
  jurusan: Jurusan[];
  kelas: Kelas[];
  terpilihKelas?: number;
  wajib?: boolean;
}) {
  const jurusanAwal = (() => {
    const k = kelas.find((x) => x.id === terpilihKelas);
    return k ? k.jurusanId : 0;
  })();

  const [idJurusan, setIdJurusan] = useState(jurusanAwal ? String(jurusanAwal) : '');
  const [idKelas, setIdKelas] = useState(terpilihKelas ? String(terpilihKelas) : '');

  const pilihanKelas = kelas.filter((k) => String(k.jurusanId) === idJurusan);

  return (
    <>
      <label htmlFor="jurusan_id">Jurusan</label>
      <select
        id="jurusan_id"
        value={idJurusan}
        required={wajib}
        onChange={(e) => {
          setIdJurusan(e.target.value);
          // Kelas lama tidak lagi berlaku kalau jurusannya diganti.
          setIdKelas('');
        }}
      >
        <option value="">— pilih jurusan —</option>
        {jurusan.map((j) => (
          <option key={j.id} value={j.id}>
            {j.nama}
          </option>
        ))}
      </select>

      <label htmlFor="kelas_id">Kelas</label>
      <select
        id="kelas_id"
        name="kelas_id"
        value={idKelas}
        required={wajib}
        disabled={!idJurusan}
        onChange={(e) => setIdKelas(e.target.value)}
      >
        <option value="">
          {idJurusan ? '— pilih kelas —' : '— pilih jurusan dulu —'}
        </option>
        {pilihanKelas.map((k) => (
          <option key={k.id} value={k.id}>
            {k.nama}
          </option>
        ))}
      </select>
    </>
  );
}