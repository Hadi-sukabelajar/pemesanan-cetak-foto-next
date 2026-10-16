import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { BadgeBayar, BadgeStatus } from '@/components/Badge';
import { TombolAksi } from '@/components/TombolAksi';
import { semuaKelas, STATUS_BAYAR_LABEL, STATUS_PESANAN_LABEL } from '@/lib/orders';
import { daftarPesanan, hitungPesanan, type Syarat } from '@/lib/query-admin';
import { rupiah, tgl, kapital } from '@/lib/format';
import { aksiBayar, aksiHapus } from '../actions';

export const metadata: Metadata = { title: 'Pesanan' };

const PER_HALAMAN = 20;

export default async function HalamanPesanan({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await wajibAdmin();
  const sp = await searchParams;

  const kelasNum = sp.kelas ? Number(sp.kelas) : NaN;
  const syarat: Syarat = {
    cari: (sp.q ?? '').trim() || undefined,
    statusBayar: sp.bayar || undefined,
    status: sp.status || undefined,
    kelasId: Number.isInteger(kelasNum) ? kelasNum : undefined,
  };

  const [token, kelas] = await Promise.all([csrfToken(), semuaKelas()]);

  const total = await hitungPesanan(syarat);
  const totalHal = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const hal = Math.min(Math.max(1, Number(sp.page) || 1), totalHal);

  const baris = await daftarPesanan(syarat, {
    ambil: PER_HALAMAN,
    lewati: (hal - 1) * PER_HALAMAN,
  });

  /** Susun query string, mempertahankan filter yang sedang aktif. */
  const qs = (tambah: Record<string, string | number | undefined> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...tambah })) {
      if (v !== undefined && v !== '' && k !== 'page') p.set(k, String(v));
    }
    const hal = tambah.page;
    if (hal !== undefined && hal !== 1) p.set('page', String(hal));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <Ruang judul="Pesanan" aktif="pesanan" lebar>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Pesanan ({total})</h1>
        <div className="row">
          <a className="btn ghost sm" href={`/ekspor${qs()}`}>
            Unduh CSV
          </a>
          <Link className="btn gold sm" href="/transaksi">
            + Pesanan offline
          </Link>
        </div>
      </div>

      <form method="get" className="filter">
        <div>
          <label htmlFor="q">Cari</label>
          <input
            type="search"
            id="q"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="kode / nama"
          />
        </div>
        <div>
          <label htmlFor="bayar">Pembayaran</label>
          <select id="bayar" name="bayar" defaultValue={sp.bayar ?? ''}>
            <option value="">Semua</option>
            {Object.entries(STATUS_BAYAR_LABEL).map(([k, [lbl]]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={sp.status ?? ''}>
            <option value="">Semua</option>
            {Object.entries(STATUS_PESANAN_LABEL).map(([k, [lbl]]) => (
              <option key={k} value={k}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kelas">Kelas</label>
          <select id="kelas" name="kelas" defaultValue={sp.kelas ?? ''}>
            <option value="">Semua</option>
            {kelas.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: 'end' }}>
          <button className="btn block" type="submit">
            Terapkan
          </button>
        </div>
      </form>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Bayar</th>
              <th>Status</th>
              <th>Antrian</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((p) => (
              <tr key={String(p.id)}>
                <td>
                  <b>{p.kode as string}</b>
                  <br />
                  <span className="muted">{tgl(p.dibuatPada as Date)}</span>
                </td>
                <td>
                  {p.nama as string}
                  <br />
                  <span className="muted">
                    {p.kelasNama as string}
                    {p.penggunaId ? '' : ' · offline'}
                  </span>
                </td>
                <td>{p.ringkas as string}</td>
                <td className="num">{rupiah(p.total as number)}</td>
                <td>
                  <BadgeBayar status={p.statusBayar as string} />
                  {p.metode ? (
                    <>
                      <br />
                      <span className="muted">{kapital(p.metode as string)}</span>
                    </>
                  ) : null}
                </td>
                <td>
                  <BadgeStatus status={p.status as string} />
                </td>
                <td>{p.noAntrian ? <b>{p.noAntrian}</b> : '-'}</td>
                <td>
                  <div className="row">
                    {p.statusBayar !== 'sudah' && p.status !== 'dibatalkan' && (
                      <TombolAksi
                        action={aksiBayar}
                        csrf={token}
                        id={Number(p.id)}
                        back={`/pesanan${qs()}`}
                        aksi="bayar"
                        label="Lunas"
                        warna="ok"
                        nama="metode"
                        nilai={(p.metode as string) || 'cash'}
                        konfirmasi={`Konfirmasi ${p.kode as string} sudah dibayar?`}
                      />
                    )}
                    <Link className="btn sm ghost" href={`/transaksi/${p.id}`}>
                      Edit
                    </Link>
                    {p.statusBayar === 'sudah' && (
                      <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
                        Kuitansi
                      </a>
                    )}
                    <TombolAksi
                      action={aksiHapus}
                      csrf={token}
                      id={Number(p.id)}
                      back={`/pesanan${qs()}`}
                      aksi="hapus"
                      label="Hapus"
                      warna="danger"
                      konfirmasi={`Hapus pesanan ${p.kode as string} permanen?`}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={8} className="center muted">
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalHal > 1 && (
        <div className="pager">
          {Array.from({ length: totalHal }, (_, i) => i + 1).map((i) =>
            i === hal ? (
              <span key={i} className="cur">
                {i}
              </span>
            ) : (
              <Link key={i} href={`/pesanan${qs({ page: i })}`}>
                {i}
              </Link>
            ),
          )}
        </div>
      )}
    </Ruang>
  );
}