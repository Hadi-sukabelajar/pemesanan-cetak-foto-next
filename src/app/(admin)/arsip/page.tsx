import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibStaf } from '@/lib/auth/rbac';
import { Ruang } from '@/components/Ruang';
import { BadgeStatus } from '@/components/Badge';
import { daftarPesanan } from '@/lib/query-admin';
import { rupiah, tgl } from '@/lib/format';

export const metadata: Metadata = { title: 'Arsip' };

export default async function HalamanArsip({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; hal?: string }>;
}) {
  await wajibStaf();
  const { tab, q, hal } = await searchParams;
  const cari = (q ?? '').trim();
  const halaman = Math.max(1, Number(hal) || 1);
  const perHal = 50;
  const tabSekarang = tab === 'semua' ? 'semua' : 'siap';

  const baris = await daftarPesanan(
    tabSekarang === 'siap'
      ? { cari, arsip: 'siap', statusBayar: 'sudah', kategori: 'semua' }
      : { cari, kategori: 'semua' },
    { ambil: perHal, lewati: (halaman - 1) * perHal, urut: 'antrian' },
  );

  const qs = (t: Record<string, string>) =>
    `/arsip?${new URLSearchParams({ tab: tabSekarang, ...(cari ? { q: cari } : {}), ...t })}`;

  return (
    <Ruang judul="Arsip" aktif="arsip" lebar>
      <h1>Arsip Cetak</h1>

      <nav className="tabs">
        <Link className={tabSekarang === 'siap' ? 'on' : ''} href="/arsip?tab=siap">
          Siap diambil
        </Link>
        <Link className={tabSekarang === 'semua' ? 'on' : ''} href="/arsip?tab=semua">
          Semua
        </Link>
        <Link href="/upload-foto?tab=proses">Upload Foto</Link>
      </nav>

      <form method="get" className="row" style={{ marginBottom: '1rem' }}>
        <input type="hidden" name="tab" value={tabSekarang} />
        <input
          type="search"
          name="q"
          defaultValue={cari}
          placeholder="Cari kode / nama"
          style={{ maxWidth: 320 }}
        />
        <button className="btn sm" type="submit">
          Cari
        </button>
      </form>

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama / Kelas</th>
              <th>Pesan</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th>Foto</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((p) => (
              <tr key={String(p.id)}>
                <td>
                  {p.noAntrian ? (
                    <b>{p.noAntrian}</b>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <b>{p.nama as string}</b>
                  <br />
                  <span className="muted">
                    {p.kelasNama as string} · {p.kode as string} · {tgl(p.dibuatPada as Date)}
                  </span>
                </td>
                <td>{p.ringkas as string}</td>
                <td className="num">{rupiah(p.total as number)}</td>
                <td>
                  <BadgeStatus status={p.status as string} />
                </td>
                <td>{p.fotoHasil ? 'Sudah' : <span className="muted">Belum</span>}</td>
                <td>
                  <a className="btn sm ghost" href={`/kuitansi/${p.id}`}>
                    Kuitansi
                  </a>
                </td>
              </tr>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={7} className="center muted">
                  {tabSekarang === 'siap'
                    ? 'Tidak ada pesanan yang siap diambil.'
                    : 'Belum ada pesanan.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="row mt">
        {halaman > 1 && (
          <Link className="btn sm ghost" href={qs({ hal: String(halaman - 1) })}>
            ‹ Sebelumnya
          </Link>
        )}
        <span className="muted">Halaman {halaman}</span>
        {baris.length === perHal && (
          <Link className="btn sm ghost" href={qs({ hal: String(halaman + 1) })}>
            Berikutnya ›
          </Link>
        )}
      </div>
    </Ruang>
  );
}