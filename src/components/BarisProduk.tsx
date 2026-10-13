'use client';

import { useMemo, useState } from 'react';

type Produk = {
  id: number;
  nama: string;
  keterangan: string | null;
  harga: number;
  nonaktif: boolean;
  foto: string | null;
};

/**
 * Baris produk + pengatur jumlah.
 *
 * Perhitungan total dilakukan DI BROWSER untuk tampilan responsif, tetapi
 * harga yang dipakai server saat menyimpan selalu diambil ulang dari
 * database — jadi manipulasi di browser tidak berpengaruh apa pun.
 */
export function BarisProduk({
  produk,
  qtyAwal = {},
}: {
  produk: Produk[];
  /**
   * Jumlah yang sudah terisi pada pesanan lama, dipakai saat MENGEDIT.
   *
   * Tanpa ini, form edit selalu mulai dari nol — sehingga siapa pun yang
   * mengedipesan tanpa menyentuh tombolnya akan menghapus seluruh itemnya.
   */
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

  const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  const ubah = (id: number, delta: number) => {
    setJumlah((j) => {
      const nilai = Math.max(0, Math.min(50, (j[id] ?? 0) + delta));
      return { ...j, [id]: nilai };
    });
  };

  return (
    <>
      {produk.map((p) => (
        <div key={p.id} className="card product">
          {p.foto && (
            <a href={p.foto} target="_blank" className="pthumb" title="Lihat contoh">
              <img src={p.foto} alt={`Contoh ${p.nama}`} loading="lazy" />
            </a>
          )}
          <div className="info">
            <div
              className="row"
              style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}
            >
              <b className="pname">
                {p.nama}
                {p.nonaktif && (
                  <>
                    {' '}
                    <span className="badge b-muted">nonaktif</span>
                  </>
                )}
              </b>
              <span className="pprice">
                {rupiah(p.harga)}
                <small> / buah</small>
              </span>
            </div>
            {p.keterangan && <p className="muted">{p.keterangan}</p>}
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