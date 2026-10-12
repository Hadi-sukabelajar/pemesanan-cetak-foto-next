import type { Metadata } from 'next';
import Link from 'next/link';
import { Ruang, KepalaHalaman } from '@/components/Ruang';
import { wajibSiswa } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { FormCsrf } from '@/components/FormCsrf';
import { BadgeBayar, BadgeStatus } from '@/components/Badge';
import { pengaturanMap, judulAcara } from '@/lib/settings';
import { itemPesanan } from '@/lib/orders';
import { pesanan } from '@/lib/db/schema';
import { semuaPesananMilik } from '@/lib/pesanan-akses';
import { rupiah, tgl } from '@/lib/format';
import { aksiHapusPesanan } from '../actions';

export const metadata: Metadata = { title: 'Pesanan Saya' };

export default async function HalamanPesananSaya() {
  const u = await wajibSiswa();
  const [token, set] = await Promise.all([csrfToken(), pengaturanMap()]);

  const daftar = await semuaPesananMilik(u);

  return (
    <Ruang judul="Pesanan Saya" aktif="riwayat">
      <KepalaHalaman
        eyebrow={judulAcara(set)}
        judul="Pesanan & Arsip Foto Saya"
      >
        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}
        >
          <p className="muted" style={{ margin: 0 }}>
            Pantau status pembayaran, nomor antrian, dan foto hasil pesananmu.
          </p>
          <Link className="btn gold sm" href="/pesan">
            + Pesan baru
          </Link>
        </div>
      </KepalaHalaman>

      {daftar.length === 0 && (
        <div className="card center muted">
          Belum ada pesanan. <Link href="/pesan">Buat pesanan pertama</Link>.
        </div>
      )}

      {daftar.map((p) => (
        <KartuPesanan key={p.id} p={p} token={token} />
      ))}
    </Ruang>
  );
}

async function KartuPesanan({
  p,
  token,
}: {
  p: typeof pesanan.$inferSelect;
  token: string;
}) {
  const items = await itemPesanan(p.id);

  return (
    <div className="card order-card">
      <div className="oc-top">
        <div>
          <div className="oc-ref">
            {tgl(p.dibuatPada)} · {p.kelasNama}
          </div>
          <h2 className="oc-title">{p.kode}</h2>
        </div>
        <div className="row">
          <BadgeBayar status={p.statusBayar} />
          <BadgeStatus status={p.status} />
        </div>
      </div>

      <div className="oc-panel">
        <div>
          <small>Item pesanan</small>
          {items.map((it) => (
            <div key={it.id} className="oc-val">
              {it.namaProduk} × {it.qty}
            </div>
          ))}
        </div>
        <div>
          <small>Nomor antrian</small>
          <div className="oc-val big">{p.noAntrian ?? '—'}</div>
        </div>
        <div>
          <small>Total</small>
          <div className="oc-val big">{rupiah(p.total)}</div>
        </div>
      </div>

      {p.fotoHasil && (
        <div className="alert a-ok">
          📷 Foto hasilmu sudah siap:{' '}
          <a href={`/api/foto/${p.id}?dl=1`}>
            <b>{p.namaFile}</b>
          </a>{' '}
          · <a href={`/api/foto/${p.id}`}>lihat</a>
        </div>
      )}

      {p.metode === 'cash' && p.statusBayar === 'belum' && (
        <div className="alert a-info">Menunggu pembayaran tunai ke panitia.</div>
      )}

      {p.metode === 'transfer' && p.statusBayar === 'menunggu_verifikasi' && (
        <div className="alert a-info">
          Bukti transfer sedang diverifikasi admin
          {p.buktiTransfer && (
            <>
              {' · '}
              <a href={`/api/bukti/${p.id}`} target="_blank">
                lihat bukti
              </a>
            </>
          )}
          .
        </div>
      )}

      <div className="row">
        <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
          Lihat kuitansi
        </a>
        {p.statusBayar !== 'sudah' && p.status !== 'dibatalkan' && (
          <>
            <a className="btn sm gold" href={`/pesan/${p.id}/bayar`}>
              Bayar
            </a>
            {p.statusBayar !== 'menunggu_verifikasi' && (
              <a className="btn sm ghost" href={`/pesan?id=${p.id}`}>
                Ubah
              </a>
            )}
            <form
              action={aksiHapusPesanan}
              className="inline"
              data-confirm="Hapus pesanan ini?"
            >
              <FormCsrf token={token} />
              <input type="hidden" name="id" value={p.id} />
              <button className="btn sm danger" type="submit">
                Hapus
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}