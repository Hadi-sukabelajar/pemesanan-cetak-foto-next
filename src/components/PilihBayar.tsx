'use client';

import { useState } from 'react';
import { UploadBukti } from './UploadBukti';

type Props = {
  pesananId: number;
  token: string;
  metodeAwal: string | null;
  infoCash: string;
  infoTransfer: string;
  total: number;
  sudahAdaBukti: boolean;
};

const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

/**
 * Pilihan Cash / Transfer.
 *
 * Bagian detail metode ikut disembunyikan lewat state, menggantikan
 * JavaScript `display:none` versi PHP.
 */
export function PilihBayar({
  pesananId,
  token,
  metodeAwal,
  infoCash,
  infoTransfer,
  total,
  sudahAdaBukti,
}: Props) {
  const [metode, setMetode] = useState<string>(metodeAwal ?? 'cash');
  const [pathnameBukti, setPathnameBukti] = useState<string>('');

  return (
    <form action="/api/bayar" method="post" id="form-bayar">
      <input type="hidden" name="_csrf" value={token} />
      <input type="hidden" name="id" value={pesananId} />
      <input type="hidden" name="bukti" value={pathnameBukti} />

      <div className="pay-choice">
        <label>
          <input
            type="radio"
            name="metode"
            value="cash"
            checked={metode === 'cash'}
            onChange={() => setMetode('cash')}
          />
          <span>💵 Cash</span>
        </label>
        <label>
          <input
            type="radio"
            name="metode"
            value="transfer"
            checked={metode === 'transfer'}
            onChange={() => setMetode('transfer')}
          />
          <span>🏦 Transfer</span>
        </label>
      </div>

      {metode === 'cash' && (
        <div className="mt">
          <div className="alert a-info">{infoCash}</div>
        </div>
      )}

      {metode === 'transfer' && (
        <div className="mt">
          <div className="alert a-info">
            {infoTransfer.split('\n').map((baris, i) => (
              <div key={i}>{baris}</div>
            ))}
            <b>Nominal: {rupiah(total)}</b>
          </div>

          <UploadBukti onSelesai={(pathname) => setPathnameBukti(pathname)} />

          <div className="hint">
            JPG / PNG / WEBP / PDF, maksimal 2 MB.
            {sudahAdaBukti && (
              <>
                {' '}
                Bukti sebelumnya sudah terkirim — upload baru akan menggantikannya.
              </>
            )}
          </div>
        </div>
      )}

      <button className="btn gold block mt" type="submit">
        Konfirmasi Pembayaran
      </button>
    </form>
  );
}