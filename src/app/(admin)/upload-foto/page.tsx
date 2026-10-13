import type { Metadata } from 'next';
import Link from 'next/link';
import { wajibFoto } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { BadgeBayar, BadgeStatus } from '@/components/Badge';
import { FormCsrf } from '@/components/FormCsrf';
import { daftarPesanan } from '@/lib/query-admin';
import { rupiah, tgl } from '@/lib/format';
import { aksiLepasFoto } from './actions';
import { UnggahFotoForm } from './UnggahFotoForm';

export const metadata: Metadata = { title: 'Upload Foto' };

export default async function HalamanUploadFoto({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const u = await wajibFoto();
  const { tab, q } = await searchParams;
  const token = await csrfToken();
  const cari = (q ?? '').trim();
  const tabSekarang = tab === 'sudah' ? 'sudah' : 'proses';

  // Hanya pesanan lunas & tidak dibatalkan yang relevan untuk foto hasil.
  const baris = await daftarPesanan({
    cari,
    kategori: 'semua',
    statusBayar: 'sudah',
    foto: tabSekarang === 'sudah' ? 'sudah' : 'proses',
  });

  const back = `/upload-foto?tab=${tabSekarang}`;

  return (
    <Ruang judul="Upload Foto" aktif="foto" lebar>
      <h1>📷 Upload Foto Hasil</h1>

      {u.peran === 'fotografer' && (
        <div className="alert a-info">
          Kamu masuk sebagai fotografer: hanya boleh mengunggah foto hasil. Data pembayaran dan pengguna
          tidak bisa dibuka.
        </div>
      )}

      <nav className="tabs">
        <Link className={tabSekarang === 'proses' ? 'on' : ''} href="/upload-foto?tab=proses">
          Belum ada foto
        </Link>
        <Link className={tabSekarang === 'sudah' ? 'on' : ''} href="/upload-foto?tab=sudah">
          Sudah ada foto
        </Link>
        <Link href="/arsip">Arsip</Link>
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

      {baris.length === 0 ? (
        <div className="alert a-ok">
          {tabSekarang === 'proses'
            ? 'Semua pesanan lunas sudah punya foto hasil.'
            : 'Belum ada pesanan lunas yang terlampiri foto.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {baris.map((p) => (
            <div className="card" key={String(p.id)}>
              <div className="row" style={{ flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="row">
                    {p.noAntrian ? (
                      <span className="badge b-accent">Antrian {p.noAntrian}</span>
                    ) : (
                      <span className="muted">tanpa nomor</span>
                    )}
                    <b>{p.nama as string}</b>
                  </div>
                  <div className="muted">
                    {p.kelasNama as string} · {p.kode as string} · {tgl(p.dibuatPada as Date)}
                  </div>
                  <div className="row mt">
                    <span className="muted">
                      {p.ringkas as string} · <b>{rupiah(p.total as number)}</b>
                    </span>
                    <BadgeBayar status={p.statusBayar as string} />
                    <BadgeStatus status={p.status as string} />
                  </div>
                  {tabSekarang === 'sudah' && p.namaFile && (
                    <div className="hint">Nama file: {p.namaFile as string}</div>
                  )}
                </div>

                <div style={{ minWidth: 290 }}>
                  <UnggahFotoForm
                    id={String(p.id)}
                    back={back}
                    kode={String(p.kode)}
                    sudahAda={tabSekarang === 'sudah'}
                  />
                  {tabSekarang === 'sudah' && (
                    <form
                      action={aksiLepasFoto}
                      style={{ marginTop: '.5rem' }}
                      data-confirm={`Lepas foto hasil untuk ${String(p.kode)}? Berkasnya dihapus dari penyimpanan dan tidak bisa dikembalikan.`}
                    >
                      <FormCsrf token={token} />
                      <input type="hidden" name="id" value={String(p.id)} />
                      <input type="hidden" name="back" value={back} />
                      <button className="btn sm danger" type="submit">
                        Lepas foto
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="muted">
        Foto dikirim langsung ke penyimpanan lalu diperiksa ulang di server. Maksimal 15 MB per foto,
        format JPG/PNG/WEBP. Hanya pesanan yang sudah lunas yang boleh dilampiri.
      </p>
    </Ruang>
  );
}