'use client';

/** Tombol cetak / simpan PDF untuk kuitansi. */
export function TombolCetak() {
  return (
    <button className="btn ghost" type="button" onClick={() => window.print()}>
      Cetak / Simpan PDF
    </button>
  );
}
