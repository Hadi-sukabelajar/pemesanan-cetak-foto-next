import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { TombolAksi } from '@/components/TombolAksi';
import { daftarPesanan, rekapPenghasilan, penghasilanPerHari } from '@/lib/query-admin';
import { rupiah, tgl, kapital } from '@/lib/format';
import { aksiStatus, aksiHapus } from '../actions';

export const metadata: Metadata = { title: 'Riwayat & Penghasilan' };

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export default async function HalamanRiwayat({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; q?: string }>;
}) {
  await wajibAdmin();
  const sp = await searchParams;
  const token = await csrfToken();

  const dari = POLA_TANGGAL.test(sp.dari ?? '') ? sp.dari! : '';
  const sampai = POLA_TANGGAL.test(sp.sampai ?? '') ? sp.sampai! : '';
  const cari = (sp.q ?? '').trim();

  const syarat = { ...(dari ? { dari } : {}), ...(sampai ? { sampai } : {}), ...(cari ? { cari } : {}) };

  const [rekap, perHari, selesai] = await Promise.all([
    rekapPenghasilan(syarat),
    penghasilanPerHari(syarat),
    daftarPesanan({ ...syarat, selesai: true }, { ambil: 500 }),
  ]);

  return (
    <Ruang judul="Riwayat & Penghasilan" aktif="riwayat_admin" lebar>
      <h1>Riwayat Selesai &amp; Penghasilan</h1>

      <form method="get" className="filter">
        <div>
          <label htmlFor="dari">Dari tanggal bayar</label>
          <input type="date" id="dari" name="dari" defaultValue={dari} />
        </div>
        <div>
          <label htmlFor="sampai">Sampai</label>
          <input type="date" id="sampai" name="sampai" defaultValue={sampai} />
        </div>
        <div>
          <label htmlFor="q">Cari riwayat</label>
          <input type="search" id="q" name="q" defaultValue={cari} placeholder="nama / kode" />
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <button className="btn sm" type="submit">
            Terapkan
          </button>
          {(dari || sampai || cari) && (
            <Link className="btn sm ghost" href="/riwayat">
              Reset
            </Link>
          )}
        </div>
      </form>

      <div className="grid stats" style={{ marginBottom: '1rem' }}>
        <div className="stat">
          <b>{rupiah(rekap.uang)}</b>
          <span>Total penghasilan (semua lunas)</span>
        </div>
        <div className="stat">
          <b>{rupiah(rekap.uangSelesai)}</b>
          <span>Dari pesanan selesai</span>
        </div>
        <div className="stat">
          <b>{rupiah(rekap.uangProses)}</b>
          <span>Lunas, masih diproses</span>
        </div>
        <div className="stat">
          <b>{rupiah(rekap.cash)}</b>
          <span>Via cash</span>
        </div>
        <div className="stat">
          <b>{rupiah(rekap.transfer)}</b>
          <span>Via transfer</span>
        </div>
        <div className="stat">
          <b>
            {rekap.jmlSelesai} / {rekap.jml}
          </b>
          <span>Pesanan selesai / lunas</span>
        </div>
      </div>

      <div className="mon-grid">
        <div>
          <h2>Penghasilan per hari</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal bayar</th>
                  <th className="num">Pesanan</th>
                  <th className="num">Penghasilan</th>
                </tr>
              </thead>
              <tbody>
                {perHari.map((r) => (
                  <tr key={r.hari}>
                    <td>{tgl(r.hari, false)}</td>
                    <td className="num">{r.jml}</td>
                    <td className="num">
                      <b>{rupiah(r.uang)}</b>
                    </td>
                  </tr>
                ))}
                {perHari.length === 0 && (
                  <tr>
                    <td colSpan={3} className="center muted">
                      Belum ada pembayaran.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Riwayat pesanan selesai ({selesai.length})</h2>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Dibayar</th>
              <th>File foto</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {selesai.map((p) => (
              <tr key={String(p.id)}>
                <td>
                  <b style={{ fontSize: '1.2rem' }}>{p.noAntrian ?? '—'}</b>
                </td>
                <td>
                  <b>{p.nama as string}</b>
                  <br />
                  <span className="muted">
                    {p.kelasNama as string} · {p.kode as string}
                  </span>
                </td>
                <td>{p.ringkas as string}</td>
                <td className="num">
                  <b>{rupiah(p.total as number)}</b>
                </td>
                <td>
                  {kapital((p.metode as string) ?? '')}
                  <br />
                  <span className="muted">{tgl(p.dibayarPada as Date)}</span>
                </td>
                <td>
                  {p.fotoHasil ? (
                    <a target="_blank" href={`/api/foto/${p.id}`}>
                      {p.namaFile as string}
                    </a>
                  ) : (
                    <span className="muted">{(p.namaFile as string) || '-'}</span>
                  )}
                </td>
                <td>
                  <div className="row">
                    <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
                      Kuitansi
                    </a>
                    <a className="btn sm ghost" href={`/transaksi/${p.id}`}>
                      Detail
                    </a>
                    <TombolAksi
                      action={aksiStatus}
                      csrf={token}
                      id={Number(p.id)}
                      back="/riwayat"
                      aksi="status"
                      nama="status"
                      nilai="diproses"
                      label="Buka lagi"
                      warna="ghost"
                      konfirmasi={`Kembalikan ${p.kode as string} ke status Diproses?`}
                    />
                    <TombolAksi
                      action={aksiHapus}
                      csrf={token}
                      id={Number(p.id)}
                      back="/riwayat"
                      aksi="hapus"
                      label="Hapus"
                      warna="danger"
                      konfirmasi={`Hapus ${p.kode as string} beserta bukti & fotonya? Nominalnya tidak lagi dihitung dalam penghasilan.`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {selesai.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  Belum ada pesanan yang selesai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Penghasilan dihitung dari pesanan yang sudah lunas dan tidak dibatalkan. Pesanan yang ditandai{' '}
        <b>Selesai</b> otomatis tersimpan di sini sampai kamu menghapusnya lewat tombol <b>Hapus</b>.
      </p>
    </Ruang>
  );
}