import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { wajibAdmin } from '@/lib/auth/rbac';
import { csrfToken } from '@/lib/auth/csrf';
import { Ruang } from '@/components/Ruang';
import { FormCsrf } from '@/components/FormCsrf';
import { BadgeBayar, BadgeStatus } from '@/components/Badge';
import { PilihJurusanKelas } from '@/components/PilihJurusanKelas';
import { BarisProdukAwal } from '@/components/BarisProdukAwal';
import { TombolAksi } from '@/components/TombolAksi';
import { produkUntukForm, semuaJurusan, semuaKelas, fotoProduk, STATUS_PESANAN_LABEL } from '@/lib/orders';
import { getDb } from '@/lib/db';
import { pesanan } from '@/lib/db/schema';
import { tgl } from '@/lib/format';
import { aksiBayar, aksiTolak, aksiHapus } from '../actions';
import { aksiSimpanTransaksi } from './actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: id ? `Edit Pesanan ${id}` : 'Transaksi Baru' };
}

export default async function HalamanTransaksi({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  await wajibAdmin();
  const { id: idParam } = await params;
  const id = Number(idParam) || 0;

  const [token, jurusan, kelas] = await Promise.all([
    csrfToken(),
    semuaJurusan(),
    semuaKelas(),
  ]);

  let edit = null;
  if (id) {
    const [p] = await getDb().select().from(pesanan).where(eq(pesanan.id, id)).limit(1);
    if (!p) notFound();
    edit = p;
  }

  const produk = (await produkUntukForm({ adminMode: true, editId: id })).map((p) => ({
    id: p.id,
    nama: p.nama,
    keterangan: p.keterangan,
    harga: p.harga,
    nonaktif: !p.aktif,
    foto: fotoProduk(p),
  }));

  const qtyAwal: Record<number, number> = {};
  if (edit) {
    const { pesananItem } = await import('@/lib/db/schema');
    const items = await getDb()
      .select()
      .from(pesananItem)
      .where(eq(pesananItem.pesananId, edit.id));
    for (const it of items) {
      if (it.produkId) qtyAwal[it.produkId] = it.qty;
    }
  }

  return (
    <Ruang judul={edit ? 'Edit Pesanan' : 'Transaksi Baru'} aktif={edit ? 'pesanan' : 'transaksi'}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{edit ? `Pesanan ${edit.kode}` : 'Transaksi Baru (Admin)'}</h1>
        <Link className="btn ghost sm" href="/pesanan">
          ← Kembali
        </Link>
      </div>

      {edit && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row">
              <BadgeBayar status={edit.statusBayar} />
              <BadgeStatus status={edit.status} />
              {edit.metode && <span className="badge b-muted">{edit.metode}</span>}
              {edit.noAntrian && (
                <span className="badge b-accent">Antrian {edit.noAntrian}</span>
              )}
            </div>
            <div className="muted">
              Dibuat {tgl(edit.dibuatPada)}
              {edit.dibayarPada ? ` · Lunas ${tgl(edit.dibayarPada)}` : ''}
            </div>
          </div>

          <div className="row mt">
            {edit.buktiTransfer && (
              <a className="btn sm ghost" target="_blank" href={`/api/bukti/${edit.id}`}>
                Lihat bukti transfer
              </a>
            )}
            {edit.statusBayar !== 'sudah' ? (
              <>
                <TombolAksi
                  action={aksiBayar}
                  csrf={token}
                  id={edit.id}
                  back={`/transaksi/${edit.id}`}
                  aksi="bayar"
                  label="Tandai lunas"
                  warna="ok"
                  nama="metode"
                  nilai={edit.metode === 'transfer' ? 'transfer' : 'cash'}
                  konfirmasi="Konfirmasi sudah dibayar?"
                />
                {edit.buktiTransfer && (
                  <TombolAksi
                    action={aksiTolak}
                    csrf={token}
                    id={edit.id}
                    back={`/transaksi/${edit.id}`}
                    aksi="tolak"
                    label="Tolak bukti"
                    warna="danger"
                    konfirmasi="Tolak bukti transfer?"
                  />
                )}
              </>
            ) : (
              <a className="btn sm" href={`/kuitansi/${edit.id}`}>
                Kuitansi
              </a>
            )}
          </div>
        </div>
      )}

      <form action={aksiSimpanTransaksi} className="card" data-order-form>
        <FormCsrf token={token} />
        {edit && <input type="hidden" name="id" value={edit.id} />}

        <label htmlFor="nama">Nama</label>
        <input
          type="text"
          id="nama"
          name="nama"
          defaultValue={edit?.nama ?? ''}
          required
          maxLength={100}
        />

        <PilihJurusanKelas
          jurusan={jurusan}
          kelas={kelas}
          terpilihKelas={edit?.kelasId ?? 0}
          wajib
        />

        <label style={{ marginTop: '1.2rem' }}>Jenis pesanan</label>
        <BarisProdukAwal produk={produk} qtyAwal={qtyAwal} />

        <label htmlFor="catatan">Catatan</label>
        <textarea
          id="catatan"
          name="catatan"
          rows={2}
          maxLength={255}
          defaultValue={edit?.catatan ?? ''}
        />

        {edit ? (
          <>
            <label htmlFor="status">Status pesanan</label>
            <select id="status" name="status" defaultValue={edit.status}>
              {Object.entries(STATUS_PESANAN_LABEL).map(([k, [lbl]]) => (
                <option key={k} value={k}>
                  {lbl}
                </option>
              ))}
            </select>

            <label htmlFor="nama_file">Nama file foto</label>
            <input
              type="text"
              id="nama_file"
              name="nama_file"
              defaultValue={edit.namaFile ?? ''}
              maxLength={150}
            />

            {edit.statusBayar === 'sudah' && (
              <div className="hint">
                Pesanan ini sudah lunas, jadi jumlah &amp; total tidak akan diubah. Yang bisa diubah hanya
                nama, kelas, catatan, dan status.
              </div>
            )}
          </>
        ) : (
          <>
            <label htmlFor="bayar">Pembayaran</label>
            <select id="bayar" name="bayar" defaultValue="cash">
              <option value="cash">💵 Sudah bayar — Cash (langsung lunas)</option>
              <option value="transfer">🏦 Sudah bayar — Transfer (langsung lunas)</option>
              <option value="">⏳ Belum bayar (konfirmasi nanti)</option>
            </select>
          </>
        )}

        <button className="btn gold block mt" type="submit">
          {edit ? 'Simpan' : 'Simpan Transaksi'}
        </button>
      </form>

      {edit && (
        <TombolAksi
          action={aksiHapus}
          csrf={token}
          id={edit.id}
          back="/pesanan"
          aksi="hapus"
          label="Hapus pesanan"
          warna="danger"
          konfirmasi="Hapus pesanan ini permanen?"
        />
      )}
    </Ruang>
  );
}
