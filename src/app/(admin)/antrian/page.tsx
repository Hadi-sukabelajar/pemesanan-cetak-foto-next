import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { TombolAksi } from '@/components/TombolAksi';
import { Ruang } from '@/components/Ruang';
import { BadgeStatus } from '@/components/Badge';
import { aksiBayar, aksiTolak, aksiStatus } from '../actions';
import {
  daftarPesanan,
  hitungPesanan,
  labelBayarAdmin,
  antrianSekarang,
} from '@/lib/query-admin';
import { rupiah, kapital, tgl } from '@/lib/format';

export const metadata: Metadata = { title: 'Antrian' };

const TAB = ['semua', 'pending', 'proses', 'lunas'] as const;
type Tab = (typeof TAB)[number];

const LABEL_TAB: Record<Tab, string> = {
  semua: 'Semua',
  pending: 'Pending (belum bayar)',
  proses: 'Dalam proses pembayaran',
  lunas: 'Sudah bayar',
};

export default async function HalamanAntrian({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  await wajibAdmin();
  const token = await csrfToken();
  const sp = await searchParams;
  const tab: Tab = (TAB as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'semua';
  const cari = (sp.q ?? '').trim();

  const syarat = { kategori: tab, ...(cari ? { cari } : {}) };

  const [jumlah, baris, antrian] = await Promise.all([
    hitungPesanan(syarat),
    daftarPesanan(syarat, { ambil: 300, urut: 'antrian' }),
    antrianSekarang(),
  ]);

  const hitungTab = async (t: Tab) =>
    hitungPesanan({ ...(cari ? { cari } : {}), kategori: t });

  const [nSemua, nPending, nProses, nLunas] = await Promise.all([
    hitungTab('semua'),
    hitungTab('pending'),
    hitungTab('proses'),
    hitungTab('lunas'),
  ]);

  return (
    <Ruang judul="Antrian" aktif="antrian" lebar>
      <h1>Nomor Antrian &amp; Status Pembayaran</h1>

      <div className="now">
        <div>
          <div style={{ color: '#cfd6ea', fontSize: '.85rem' }}>Antrian saat ini</div>
          <b>{antrian.sekarang?.no ?? '—'}</b>
        </div>
        <div>
          {antrian.sekarang ? (
            <>
              <div style={{ fontSize: '1.1rem', color: '#fff' }}>
                <b>{antrian.sekarang.nama}</b>
              </div>
              <div style={{ color: '#cfd6ea' }}>{antrian.sekarang.kelasNama}</div>
            </>
          ) : (
            <div style={{ color: '#cfd6ea' }}>Tidak ada antrian aktif.</div>
          )}
          <div style={{ color: '#cfd6ea', fontSize: '.85rem', marginTop: '.3rem' }}>
            Nomor terakhir yang dibagikan: {antrian.terakhir || '-'}
          </div>
        </div>
      </div>

      <div className="tabs">
        {TAB.map((t) => (
          <Link
            key={t}
            className={tab === t ? 'on' : ''}
            href={`?tab=${t}${cari ? `&q=${encodeURIComponent(cari)}` : ''}`}
          >
            {LABEL_TAB[t]}
            <span>({({ semua: nSemua, pending: nPending, proses: nProses, lunas: nLunas })[t]})</span>
          </Link>
        ))}
      </div>

      <form method="get" className="row" style={{ marginBottom: '1rem' }}>
        <input type="hidden" name="tab" value={tab} />
        <input
          type="search"
          name="q"
          defaultValue={cari}
          placeholder="Cari nama / kode pesanan"
          style={{ maxWidth: 320 }}
        />
        <button className="btn sm" type="submit">
          Cari
        </button>
        {cari && (
          <Link className="btn sm ghost" href={`?tab=${tab}`}>
            Reset
          </Link>
        )}
      </form>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Pembayaran</th>
              <th>Pesanan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((p) => {
              const l = labelBayarAdmin({
                statusBayar: p.statusBayar as string,
                metode: p.metode as string | null,
              });
              return (
                <tr key={String(p.id)}>
                  <td>
                    {p.noAntrian ? (
                      <b style={{ fontSize: '1.25rem' }}>{p.noAntrian}</b>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <b>{p.nama as string}</b>
                    <br />
                    <span className="muted">
                      {p.kelasNama as string} · {p.kode as string}
                      {p.penggunaId ? '' : ' · offline'}
                    </span>
                  </td>
                  <td>{p.ringkas as string}</td>
                  <td className="num">{rupiah(p.total as number)}</td>
                  <td>
                    <span className={`badge b-${l.warna}`}>{l.teks}</span>
                    {p.metode ? (
                      <>
                        <br />
                        <span className="muted">
                          {kapital(p.metode as string)}
                          {p.dibayarPada ? ` · ${tgl(p.dibayarPada as Date)}` : ''}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <BadgeStatus status={p.status as string} />
                    {p.namaFile ? (
                      <>
                        <br />
                        <span className="muted">{p.namaFile as string}</span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div className="row">
                      {p.buktiTransfer ? (
                        <a className="btn sm ghost" target="_blank" href={`/api/bukti/${p.id}`}>
                          Bukti
                        </a>
                      ) : null}
                      {p.statusBayar !== 'sudah' && p.status !== 'dibatalkan' && (
                        <TombolAksi
                          action={aksiBayar}
                          csrf={token}
                          id={Number(p.id)}
                          back={`/antrian?tab=${tab}`}
                          aksi="bayar"
                          label="Sudah bayar"
                          warna="ok"
                          nama="metode"
                          nilai={(p.metode as string) || 'cash'}
                          konfirmasi={`Konfirmasi ${p.kode as string} sudah dibayar?`}
                        />
                      )}
                      {p.buktiTransfer && p.statusBayar !== 'sudah' && (
                        <TombolAksi
                          action={aksiTolak}
                          csrf={token}
                          id={Number(p.id)}
                          back={`/antrian?tab=${tab}`}
                          aksi="tolak"
                          label="Tolak"
                          warna="danger"
                          konfirmasi="Tolak bukti transfer ini?"
                        />
                      )}
                      {p.statusBayar === 'sudah' && (
                        <>
                          {p.status !== 'selesai' && (
                            <TombolAksi
                              action={aksiStatus}
                              csrf={token}
                              id={Number(p.id)}
                              back={`/antrian?tab=${tab}`}
                              aksi="status"
                              nama="status"
                              nilai="selesai"
                              label="Selesai"
                              warna="ok"
                            />
                          )}
                          {p.status !== 'siap_cetak' && p.status !== 'selesai' && (
                            <TombolAksi
                              action={aksiStatus}
                              csrf={token}
                              id={Number(p.id)}
                              back={`/antrian?tab=${tab}`}
                              aksi="status"
                              nama="status"
                              nilai="siap_cetak"
                              label="Siap cetak"
                              warna="gold"
                            />
                          )}
                        </>
                      )}
                      <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
                        Kuitansi
                      </a>
                      <a className="btn sm ghost" href={`/transaksi/${p.id}`}>
                        Detail
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
            {baris.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  Tidak ada data pada tab ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Total {jumlah} pesanan pada tab ini. Nomor antrian terbit otomatis saat pesanan dibuat (berurutan
        sesuai waktu pesan). Pesanan baru dipanggil setelah admin menekan <b>Sudah bayar</b> di halaman
        Dashboard.
      </p>
    </Ruang>
  );
}