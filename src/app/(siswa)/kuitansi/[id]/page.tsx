import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { Ruang } from '@/components/Ruang';
import { wajibLogin, bolehBukaPesanan } from '@/lib/auth/rbac';
import { pengaturanMap, namaSekolah, judulAcara } from '@/lib/settings';
import { itemPesanan, STATUS_PESANAN_LABEL, METODE_LABEL } from '@/lib/orders';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { rupiah, tgl, kapital } from '@/lib/format';
import { flash } from '@/lib/flash';
import { TombolCetak } from '@/components/TombolCetak';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Kuitansi ${id}` };
}

export default async function HalamanKuitansi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await wajibLogin();
  const idNum = Number(id) || 0;

  const [p, set] = await Promise.all([
    getDb().select().from(pesanan).where(eq(pesanan.id, idNum)).limit(1).then((r) => r[0] ?? null),
    pengaturanMap(),
  ]);

  if (!p || !bolehBukaPesanan(u, p.penggunaId)) {
    await flash('bad', 'Kuitansi tidak ditemukan.');
    redirect('/');
  }

  const items = await itemPesanan(p.id);
  const sekolah = namaSekolah(set);
  const acara = judulAcara(set);

  const lunas = p.statusBayar === 'sudah';
  const dibatalkan = p.status === 'dibatalkan';

  const stempel = dibatalkan
    ? ['DIBATALKAN', 'bad']
    : lunas
      ? ['LUNAS', 'ok']
      : p.statusBayar === 'menunggu_verifikasi'
        ? ['MENUNGGU VERIFIKASI', 'info']
        : ['BELUM LUNAS', 'warn'];

  const bisaBayar = !lunas && !dibatalkan && u.peran === 'user';

  return (
    <Ruang judul="Kuitansi" aktif="riwayat">
      {!lunas && !dibatalkan && (
        <div className="alert a-info noprint">
          Pesanan tersimpan. Kuitansi ini berstatus <b>{stempel[0].toLowerCase()}</b>; nomor antrianmu
          sudah terbit, tapi baru dipanggil setelah admin mengonfirmasi pembayaran.
        </div>
      )}

      <div className="receipt-banner">
        <div className="rb-queue">
          <span>NOMOR ANTRIAN ANDA</span>
          <b style={p.noAntrian ? undefined : { fontSize: '2rem' }}>{p.noAntrian ?? '—'}</b>
        </div>
        <div className="rb-info">
          <span className="rb-chip">{p.kelasNama}</span>
          <h1>{p.nama}</h1>
          <p>
            {p.noAntrian && !lunas && !dibatalkan
              ? 'Selesaikan pembayaran agar nomor ini dipanggil.'
              : !p.noAntrian
                ? 'Nomor dibuat saat pembayaran dikonfirmasi (pesanan lama).'
                : `${acara} · ${sekolah}`}
          </p>
        </div>
      </div>

      <div className="kuitansi">
        <div className="k-head">
          <div>
            <span className="eyebrow">Bukti pemesanan</span>
            <h2 style={{ margin: '.1rem 0 0' }}>{acara}</h2>
            <div className="muted">{sekolah}</div>
          </div>
          <span className={`stamp s-${stempel[1]}`}>{stempel[0]}</span>
        </div>

        <dl>
          <dt>Kode pesanan</dt>
          <dd>{p.kode}</dd>
          <dt>Tanggal pesan</dt>
          <dd>{tgl(p.dibuatPada)}</dd>
          <dt>Nama</dt>
          <dd>{p.nama}</dd>
          <dt>Kelas</dt>
          <dd>{p.kelasNama}</dd>
          <dt>Metode bayar</dt>
          <dd>{p.metode ? kapital(p.metode) : 'Belum dipilih'}</dd>
          {lunas && (
            <>
              <dt>Tanggal bayar</dt>
              <dd>{tgl(p.dibayarPada)}</dd>
            </>
          )}
          <dt>Status pesanan</dt>
          <dd>{STATUS_PESANAN_LABEL[p.status]?.[0] ?? p.status}</dd>
          {p.namaFile && (
            <>
              <dt>Nama file</dt>
              <dd>{p.namaFile}</dd>
            </>
          )}
        </dl>

        <table>
          <tr>
            <th>Item</th>
            <th className="num">Harga</th>
            <th className="num">Qty</th>
            <th className="num">Subtotal</th>
          </tr>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.namaProduk}</td>
              <td className="num">{rupiah(it.harga)}</td>
              <td className="num">{it.qty}</td>
              <td className="num">{rupiah(it.harga * it.qty)}</td>
            </tr>
          ))}
        </table>

        <div className="k-total">
          <span>{lunas ? 'Total dibayar' : 'Total tagihan'}</span>
          <b>{rupiah(p.total)}</b>
        </div>
        <p className="center muted" style={{ marginBottom: 0 }}>
          Tunjukkan kuitansi ini saat sesi foto / pengambilan.
        </p>
      </div>

      {p.fotoHasil && (
        <div className="card noprint" style={{ maxWidth: 560, margin: '1rem auto 0' }}>
          <h2>Foto hasil</h2>
          <img
            src={`/api/foto/${p.id}`}
            alt={`Foto hasil ${p.nama}`}
            style={{ width: '100%', borderRadius: 10, display: 'block' }}
          />
          <div className="row mt">
            <a className="btn sm gold" href={`/api/foto/${p.id}?dl=1`}>
              Unduh {p.namaFile}
            </a>
            <a className="btn sm ghost" href={`/api/foto/${p.id}`} target="_blank">
              Buka ukuran penuh
            </a>
          </div>
        </div>
      )}

      <div
        className="row end mt noprint"
        style={{ maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}
      >
        <a className="btn ghost" href={u.peran === 'user' ? '/pesanan-saya' : '/'}>
          {u.peran === 'user' ? 'Pesanan saya' : 'Kembali'}
        </a>
        <TombolCetak />
        {u.peran === 'admin' && (
          <Link className="btn gold" href="/transaksi">
            + Transaksi baru
          </Link>
        )}
        {bisaBayar && (
          <Link className="btn gold" href={`/pesan/${p.id}/bayar`}>
            Bayar sekarang
          </Link>
        )}
      </div>
    </Ruang>
  );
}