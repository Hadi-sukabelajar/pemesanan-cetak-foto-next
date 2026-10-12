'use client';

import { useMemo, useState } from 'react';

export type ProdukTampilan = {
  id: number;
  nama: string;
  keterangan: string | null;
  harga: number;
  nonaktif: boolean;
  foto: string | null;
};

const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/**
 * Daftar produk + stepper jumlah.
 *
 * `qtyAwal` dipakai saat mengedit pesanan supaya jumlah yang sudah tersimpan
 * langsung tampil. Perhitungan total hanya untuk tampilan — harga yang dipakai
 * server saat menyimpan selalu diambil ulang dari database.
 */
export function BarisProdukAwal({
  produk,
  qtyAwal = {},
}: {
  produk: ProdukTampilan[];
  qtyAwal?: Record<number, number>;
}) {
  const [jumlah, setJumlah] = useState<Record<number, number>>(() => {
    const awal: Record<number, number> = {};
    for (const p of produk) awal[p.id] = qtyAwal[p.id] ?? 0;
    return awal;
  });

  const total = useMemo(
    () => produk.reduce((s, p) => s + (jumlah[p.id] ?? 0) * p.harga, 0),
    [produk, jumlah],
  );

  const ubah = (id: number, delta: number) => {
    setJumlah((j) => ({ ...j, [id]: Math.max(0, Math.min(50, (j[id] ?? 0) + delta)) }));
  };

  return (
    <>
      {produk.map((p) => (
        <div key={p.id} className="item">
          {p.foto ? (
            <a href={p.foto} target="_blank" className="pthumb sm" title="Lihat contoh">
              <img src={p.foto} alt={`Contoh ${p.nama}`} loading="lazy" />
            </a>
          ) : null}
          <div className="info">
            <b>
              {p.nama}
              {p.nonaktif ? ' ' : ''}
              {p.nonaktif && <span className="badge b-muted">nonaktif</span>}
            </b>
            <small>{rupiah(p.harga)} / buah</small>
            {p.keterangan ? (
              <p className="muted" style={{ margin: '.3rem 0 0', fontSize: '.85rem' }}>
                {p.keterangan}
              </p>
            ) : null}
          </div>
          <div className="stepper">
            <button type="button" onClick={() => ubah(p.id, -1)} aria-label={`Kurangi ${p.nama}`}>
              −
            </button>
            <input
              type="number"
              name={`qty[${p.id}]`}
              min={0}
              max={50}
              inputMode="numeric"
              value={jumlah[p.id] ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                setJumlah((j) => ({
                  ...j,
                  [p.id]: Number.isFinite(n) ? Math.max(0, Math.min(50, Math.trunc(n))) : 0,
                }));
              }}
              aria-label={`Jumlah ${p.nama}`}
            />
            <button type="button" onClick={() => ubah(p.id, 1)} aria-label={`Tambah ${p.nama}`}>
              +
            </button>
          </div>
        </div>
      ))}
      <div className="totalbar">
        <span>Total</span>
        <span>{rupiah(total)}</span>
      </div>
    </>
  );
}